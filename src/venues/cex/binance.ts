import axios from "axios";
import pino from "pino";
import process from "node:process";
import { QuoteCollector } from "../../marketdata/collector.js";
import { Quote } from "../../types/index.js";

type CexConfig = {
  enabled: boolean;
  venues: string[];
};

export class BinanceCollector extends QuoteCollector {
  private readonly logger: pino.Logger;
  private readonly config: CexConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: CexConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  start(): void {
    super.start();
    if (!this.config.venues.includes("binance")) {
      this.logger.info("binance not enabled in config");
      return;
    }
    const symbols = parseSymbols();
    if (symbols.length === 0) {
      this.logger.warn("ARB_CEX_SYMBOLS empty; no binance symbols");
      return;
    }
    this.intervalId = setInterval(async () => {
      try {
        const res = await axios.get(
          "https://api.binance.com/api/v3/ticker/bookTicker",
          { params: { symbols: JSON.stringify(symbols) }, timeout: 5000 }
        );
        const now = Date.now();
        for (const tick of res.data as Array<{
          symbol: string;
          bidPrice: string;
          askPrice: string;
        }>) {
          const base = tick.symbol.slice(0, -4);
          const quote = tick.symbol.slice(-4);
          const bid = Number(tick.bidPrice);
          const ask = Number(tick.askPrice);
          if (!bid || !ask) continue;
          const bidQuote: Quote = {
            venueId: "binance",
            base,
            quote,
            side: "sell",
            price: bid,
            size: 0,
            feeBps: 10,
            timestampMs: now,
            confidence: 0.8
          };
          const askQuote: Quote = {
            venueId: "binance",
            base,
            quote,
            side: "buy",
            price: ask,
            size: 0,
            feeBps: 10,
            timestampMs: now,
            confidence: 0.8
          };
          this.emitQuote(bidQuote);
          this.emitQuote(askQuote);
        }
      } catch (err) {
        this.logger.warn({ err }, "binance ticker failed");
      }
    }, 3000);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    super.stop();
  }
}

function parseSymbols(): string[] {
  const raw = process.env.ARB_CEX_SYMBOLS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}
