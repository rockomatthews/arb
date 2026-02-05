import axios from "axios";
import pino from "pino";
import process from "node:process";
import { QuoteCollector } from "../../marketdata/collector.js";
import { Quote } from "../../types/index.js";

type SolanaConfig = {
  enabled: boolean;
  rpcUrl: string;
};

type JupiterPair = {
  inputMint: string;
  outputMint: string;
  amount: number;
  base: string;
  quote: string;
};

export class JupiterCollector extends QuoteCollector {
  private readonly logger: pino.Logger;
  private readonly config: SolanaConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: SolanaConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  start(): void {
    super.start();
    if (!this.config.rpcUrl) {
      this.logger.warn("solana rpcUrl not set; skipping Jupiter");
      return;
    }
    const pairs = parsePairs();
    if (pairs.length === 0) {
      this.logger.warn("ARB_SOLANA_PAIRS empty; no Jupiter pairs");
      return;
    }

    this.intervalId = setInterval(async () => {
      for (const pair of pairs) {
        const url = "https://quote-api.jup.ag/v6/quote";
        try {
          const res = await axios.get(url, {
            params: {
              inputMint: pair.inputMint,
              outputMint: pair.outputMint,
              amount: pair.amount,
              slippageBps: 50
            },
            timeout: 5000
          });
          const route = res.data?.data?.[0];
          if (!route) continue;
          const outAmount = Number(route.outAmount);
          if (!pair.amount) continue;
          const price = outAmount / pair.amount;
          const quote: Quote = {
            venueId: "jupiter",
            base: pair.base,
            quote: pair.quote,
            side: "buy",
            price,
            size: pair.amount,
            feeBps: 0,
            timestampMs: Date.now(),
            confidence: 0.7,
            metadata: { routePlan: route.routePlan }
          };
          this.emitQuote(quote);
        } catch (err) {
          this.logger.warn({ err }, "Jupiter quote failed");
        }
      }
    }, 4000);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    super.stop();
  }
}

function parsePairs(): JupiterPair[] {
  const raw = process.env.ARB_SOLANA_PAIRS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as JupiterPair[];
    return parsed.filter(
      (p) => p.inputMint && p.outputMint && p.amount
    );
  } catch {
    return [];
  }
}
