import pino from "pino";
import { AppConfig } from "../config/index.js";
import { QuoteStore } from "./quoteStore.js";
import { QuoteCollector } from "./collector.js";
import { JupiterCollector } from "../venues/solana/jupiter.js";
import { BinanceCollector } from "../venues/cex/binance.js";
import { ZeroXCollector } from "../venues/evm/zeroX.js";
import { UniswapCollector } from "../venues/evm/uniswap.js";
import { Storage } from "../storage/index.js";
import { MetricsHandle } from "../observability/metrics.js";

export type MarketDataHandle = {
  store: QuoteStore;
  collectors: QuoteCollector[];
  start: () => void;
  stop: () => void;
};

export function initMarketData(
  config: AppConfig,
  logger: pino.Logger,
  storage: Storage,
  metrics?: MetricsHandle
): MarketDataHandle {
  const store = new QuoteStore(storage);
  const collectors: QuoteCollector[] = [];

  if (config.evm.enabled) {
    collectors.push(new ZeroXCollector(config.evm, logger));
    collectors.push(new UniswapCollector(config.evm, logger));
  }

  if (config.solana.enabled) {
    collectors.push(new JupiterCollector(config.solana, logger));
  }

  if (config.cex.enabled) {
    collectors.push(new BinanceCollector(config.cex, logger));
  }

  collectors.forEach((collector) => {
    collector.on("quote", (quote) => {
      store.add(quote);
      metrics?.quotesReceived.inc();
    });
    collector.on("status", (status) =>
      logger.info({ status }, "collector status")
    );
  });

  return {
    store,
    collectors,
    start: () => collectors.forEach((c) => c.start()),
    stop: () => collectors.forEach((c) => c.stop())
  };
}
