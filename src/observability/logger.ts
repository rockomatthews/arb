import pino from "pino";
import { AppConfig } from "../config/index.js";

export function createLogger(config: AppConfig): pino.Logger {
  return pino({
    level: config.logLevel,
    base: { service: "arb" }
  });
}
