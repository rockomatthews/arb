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

type UniswapPair = {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  base: string;
  quote: string;
};

export class UniswapCollector extends QuoteCollector {
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
    const pairs = parsePairs();
    if (pairs.length === 0) {
      this.logger.warn("ARB_UNISWAP_PAIRS empty; no Uniswap pairs");
      return;
    }
    const apiBase = process.env.ARB_0X_BASE_URL ?? "https://api.0x.org";
    this.intervalId = setInterval(async () => {
      for (const pair of pairs) {
        if (!this.config.chains.includes(String(pair.chainId))) continue;
        try {
          const res = await axios.get(`${apiBase}/swap/v1/quote`, {
            params: {
              chainId: pair.chainId,
              sellToken: pair.sellToken,
              buyToken: pair.buyToken,
              sellAmount: pair.sellAmount,
              includedSources: "Uniswap_V3,Uniswap_V2"
            },
            timeout: 5000
          });
          const buyAmount = Number(res.data.buyAmount);
          const sellAmount = Number(pair.sellAmount);
          if (!sellAmount) continue;
          const price = buyAmount / sellAmount;
          const quote: Quote = {
            venueId: "uniswap",
            base: pair.base,
            quote: pair.quote,
            side: "buy",
            price,
            size: sellAmount,
            feeBps: 0,
            timestampMs: Date.now(),
            confidence: 0.75,
            metadata: { chainId: pair.chainId }
          };
          this.emitQuote(quote);
        } catch (err) {
          this.logger.warn({ err }, "uniswap quote failed");
        }
      }
    }, 4000);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    super.stop();
  }
}

function parsePairs(): UniswapPair[] {
  const raw = process.env.ARB_UNISWAP_PAIRS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UniswapPair[];
    return parsed.filter(
      (p) => p.chainId && p.sellToken && p.buyToken && p.sellAmount
    );
  } catch {
    return [];
  }
}
