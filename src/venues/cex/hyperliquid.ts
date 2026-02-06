import pino from "pino";
import { QuoteCollector } from "../../marketdata/collector.js";
import { Quote } from "../../types/index.js";

type HyperliquidConfig = {
  enabled: boolean;
  apiUrl: string;
  coins: string[];
};

export class HyperliquidCollector extends QuoteCollector {
  private readonly logger: pino.Logger;
  private readonly config: HyperliquidConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: HyperliquidConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  start(): void {
    super.start();
    if (!this.config.enabled) {
      this.logger.info("hyperliquid disabled in config");
      return;
    }
    if (this.config.coins.length === 0) {
      this.logger.warn("hyperliquid coins empty; no markets configured");
      return;
    }
    void this.initAndRun();
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    super.stop();
  }

  private async initAndRun(): Promise<void> {
    const { HttpTransport, InfoClient } =
      (await import("@nktkas/hyperliquid")) as any;
    const transport = new HttpTransport({ url: this.config.apiUrl });
    const info = new InfoClient({ transport });

    this.intervalId = setInterval(async () => {
      try {
        const mids = (await info.allMids()) as Record<string, string>;
        const now = Date.now();
        for (const coin of this.config.coins) {
          const mid = Number(mids[coin]);
          if (!mid) continue;
          const base = coin;
          const quote = "USDC";
          const buy: Quote = {
            venueId: "hyperliquid",
            base,
            quote,
            side: "buy",
            price: mid,
            size: 0,
            feeBps: 2,
            timestampMs: now,
            confidence: 0.85
          };
          const sell: Quote = {
            venueId: "hyperliquid",
            base,
            quote,
            side: "sell",
            price: mid,
            size: 0,
            feeBps: 2,
            timestampMs: now,
            confidence: 0.85
          };
          this.emitQuote(buy);
          this.emitQuote(sell);
        }
      } catch (err) {
        this.logger.warn({ err }, "hyperliquid mids fetch failed");
      }
    }, 3000);
  }
}
