import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { z } from "zod";
import YAML from "yaml";

const ConfigSchema = z.object({
  mode: z.enum(["paper", "live"]).default("paper"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  dataStore: z.enum(["memory", "sqlite"]).default("memory"),
  evm: z.object({
    enabled: z.boolean().default(false),
    chains: z.array(z.string()).default([]),
    rpcUrls: z.record(z.string()).default({})
  }),
  solana: z.object({
    enabled: z.boolean().default(false),
    rpcUrl: z.string().default("")
  }),
  cex: z.object({
    enabled: z.boolean().default(false),
    venues: z.array(z.string()).default([])
  }),
  metrics: z.object({
    enabled: z.boolean().default(true),
    port: z.number().default(9102)
  }),
  storage: z.object({
    sqlitePath: z.string().default("arb.sqlite")
  }),
  risk: z.object({
    minEdgeBps: z.number().default(20),
    maxNotionalUsd: z.number().default(2000),
    maxSlippageBps: z.number().default(50)
  })
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const defaultConfig: AppConfig = {
  mode: "paper",
  logLevel: "info",
  dataStore: "memory",
  evm: { enabled: false, chains: [], rpcUrls: {} },
  solana: { enabled: false, rpcUrl: "" },
  cex: { enabled: false, venues: [] },
  metrics: { enabled: true, port: 9102 },
  storage: { sqlitePath: "arb.sqlite" },
  risk: { minEdgeBps: 20, maxNotionalUsd: 2000, maxSlippageBps: 50 }
};

function loadConfigFile(configPath: string): Partial<AppConfig> {
  if (!fs.existsSync(configPath)) return {};
  const raw = fs.readFileSync(configPath, "utf-8");
  if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
    return YAML.parse(raw) as Partial<AppConfig>;
  }
  return JSON.parse(raw) as Partial<AppConfig>;
}

export function loadConfig(): AppConfig {
  const configPath =
    process.env.ARB_CONFIG_PATH ??
    path.resolve(process.cwd(), "config.yaml");
  const fileConfig = loadConfigFile(configPath);
  const merged = {
    ...defaultConfig,
    ...fileConfig,
    mode: (process.env.ARB_MODE ?? fileConfig.mode ?? defaultConfig.mode) as
      AppConfig["mode"],
    logLevel: (process.env.ARB_LOG_LEVEL ??
      fileConfig.logLevel ??
      defaultConfig.logLevel) as AppConfig["logLevel"],
    metrics: {
      ...defaultConfig.metrics,
      ...fileConfig.metrics,
      port: Number(
        process.env.ARB_METRICS_PORT ??
          fileConfig.metrics?.port ??
          defaultConfig.metrics.port
      )
    },
    storage: {
      ...defaultConfig.storage,
      ...fileConfig.storage
    }
  };
  return ConfigSchema.parse(merged);
}
