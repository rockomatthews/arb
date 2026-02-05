import http from "node:http";
import pino from "pino";
import { Counter, Registry } from "prom-client";
import { Storage } from "../storage/index.js";
import { AppConfig } from "../config/index.js";

export type MetricsHandle = {
  registry: Registry;
  quotesReceived: Counter;
  opportunitiesFound: Counter;
  tradesExecuted: Counter;
};

export function initMetrics(
  config: AppConfig,
  logger: pino.Logger,
  storage: Storage
): MetricsHandle {
  const registry = new Registry();
  const quotesReceived = new Counter({
    name: "arb_quotes_received_total",
    help: "Number of quotes ingested",
    registers: [registry]
  });
  const opportunitiesFound = new Counter({
    name: "arb_opportunities_found_total",
    help: "Number of opportunities detected",
    registers: [registry]
  });
  const tradesExecuted = new Counter({
    name: "arb_trades_executed_total",
    help: "Number of trades executed",
    registers: [registry]
  });

  if (config.metrics.enabled) {
    const port = config.metrics.port;
    const server = http.createServer(async (req, res) => {
      if (req.url !== "/metrics") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", registry.contentType);
      res.writeHead(200);
      res.end(await registry.metrics());
    });
    server.listen(port, () =>
      logger.info({ port }, "metrics server started")
    );
  }

  if (storage) {
    setInterval(() => {
      storage.insertMetric(
        "quotes_received_total",
        quotesReceived.hashMap[""]?.value ?? 0
      );
      storage.insertMetric(
        "opportunities_found_total",
        opportunitiesFound.hashMap[""]?.value ?? 0
      );
      storage.insertMetric(
        "trades_executed_total",
        tradesExecuted.hashMap[""]?.value ?? 0
      );
    }, 10000);
  }

  return { registry, quotesReceived, opportunitiesFound, tradesExecuted };
}
