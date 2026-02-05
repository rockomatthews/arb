import { test } from "node:test";
import assert from "node:assert/strict";
import { findOpportunities } from "../src/opportunities/engine.js";
import { AppConfig } from "../src/config/index.js";

test("findOpportunities detects profitable spread", () => {
  const config: AppConfig = {
    mode: "paper",
    logLevel: "info",
    dataStore: "memory",
    evm: { enabled: false, chains: [], rpcUrls: {} },
    solana: { enabled: false, rpcUrl: "" },
    cex: { enabled: false, venues: [] },
    metrics: { enabled: false, port: 9102 },
    storage: { sqlitePath: "arb.sqlite" },
    risk: { minEdgeBps: 5, maxNotionalUsd: 1000, maxSlippageBps: 50 }
  };
  const quotes = [
    {
      venueId: "a",
      base: "ETH",
      quote: "USDC",
      side: "buy",
      price: 2000,
      size: 1,
      feeBps: 10,
      timestampMs: Date.now(),
      confidence: 0.9
    },
    {
      venueId: "b",
      base: "ETH",
      quote: "USDC",
      side: "sell",
      price: 2025,
      size: 1,
      feeBps: 10,
      timestampMs: Date.now(),
      confidence: 0.9
    }
  ];

  const opps = findOpportunities(quotes, config);
  assert.equal(opps.length, 1);
  assert.ok(opps[0].expectedProfitUsd > 0);
});
