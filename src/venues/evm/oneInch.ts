import axios from "axios";
import pino from "pino";
import process from "node:process";
import { QuoteCollector } from "../../marketdata/collector.js";
import { Quote } from "../../types/index.js";

type EvmConfig = {
  enabled: boolean;
  chains: string[];
  rpcUrls: Record<string, string>;
};

type OneInchPair = {
  chainId: string;
  src: string;
  dst: string;
  amount: string;
  base: string;
  quote: string;
};

export class OneInchCollector extends QuoteCollector {
  private readonly logger: pino.Logger;
  private readonly config: EvmConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: EvmConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  start(): void {
    super.start();
    const apiKey = process.env.ONE_INCH_API_KEY;
    const pairs = parsePairs();

    if (!apiKey) {
      this.logger.warn(
        "ONE_INCH_API_KEY not set; skipping 1inch quotes"
      );
      return;
    }

    if (pairs.length === 0) {
      this.logger.warn(
        "ARB_EVM_PAIRS empty; no 1inch pairs configured"
      );
      return;
    }

    this.intervalId = setInterval(async () => {
      for (const pair of pairs) {
        if (!this.config.chains.includes(pair.chainId)) continue;
        const url = `https://api.1inch.dev/swap/v6.0/${pair.chainId}/quote`;
        try {
          const res = await axios.get(url, {
            params: {
              src: pair.src,
              dst: pair.dst,
              amount: pair.amount
            },
            headers: {
              Authorization: `Bearer ${apiKey}`
            },
            timeout: 5000
          });
          const toTokenAmount = Number(res.data.toTokenAmount);
          const fromTokenAmount = Number(res.data.fromTokenAmount);
          if (fromTokenAmount <= 0) continue;
          const price = toTokenAmount / fromTokenAmount;
          const quote: Quote = {
            venueId: "1inch",
            base: pair.base,
            quote: pair.quote,
            side: "buy",
            price,
            size: fromTokenAmount,
            feeBps: 0,
            timestampMs: Date.now(),
            confidence: 0.7,
            metadata: { chainId: pair.chainId }
          };
          this.emitQuote(quote);
        } catch (err) {
          this.logger.warn({ err }, "1inch quote failed");
        }
      }
    }, 4000);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    super.stop();
  }
}

function parsePairs(): OneInchPair[] {
  const raw = process.env.ARB_EVM_PAIRS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OneInchPair[];
    return parsed.filter(
      (p) => p.chainId && p.src && p.dst && p.amount
    );
  } catch {
    return [];
  }
}
