import { loadConfig } from "./config/index.js";
import { initMarketData } from "./marketdata/index.js";
import { findOpportunities } from "./opportunities/engine.js";
import { PaperTrader } from "./sim/paperTrader.js";
import { ExecutionEngine } from "./execution/index.js";
import { createLogger } from "./observability/logger.js";
import { initStorage } from "./storage/index.js";
import { initMetrics } from "./observability/metrics.js";

const config = loadConfig();
const logger = createLogger(config);
const storage = initStorage(config, logger);
const metrics = initMetrics(config, logger, storage);

logger.info(
  {
    mode: config.mode,
    evmEnabled: config.evm.enabled,
    solanaEnabled: config.solana.enabled,
    cexEnabled: config.cex.enabled
  },
  "arb system starting"
);

const marketData = initMarketData(config, logger, storage, metrics);
marketData.start();
logger.info("market data collectors started");

if (config.mode === "paper") {
  const paperTrader = new PaperTrader();
  setInterval(() => {
    const opportunities = findOpportunities(
      marketData.store.all(),
      config
    );
    for (const opp of opportunities) {
      if (storage) storage.insertOpportunity(opp);
      metrics.opportunitiesFound.inc();
      const trade = paperTrader.execute(opp);
      if (storage) {
        storage.insertTrade({
          id: `paper-${trade.opportunityId}`,
          venueId: "paper",
          base: opp.base,
          quote: opp.quote,
          side: "buy",
          size: trade.size,
          price: opp.buyPrice,
          feeUsd: 0,
          timestampMs: trade.executedAtMs
        });
      }
      metrics.tradesExecuted.inc();
      logger.info(
        { opp, trade, pnlUsd: paperTrader.getPnlUsd() },
        "paper trade executed"
      );
    }
  }, 5000);
}

if (config.mode === "live") {
  const executor = new ExecutionEngine(config, logger);
  setInterval(async () => {
    const opportunities = findOpportunities(
      marketData.store.all(),
      config
    );
    for (const opp of opportunities) {
      if (storage) storage.insertOpportunity(opp);
      metrics.opportunitiesFound.inc();
      const orders = await executor.execute(opp);
      if (orders.length) {
        orders.forEach((order) => storage?.insertOrder(order));
        metrics.tradesExecuted.inc();
        logger.info({ opp, orders }, "live execution completed");
      }
    }
  }, 5000);
}
