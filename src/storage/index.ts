import pino from "pino";
import { AppConfig } from "../config/index.js";
import { SqliteStore } from "./sqlite.js";

export type Storage = SqliteStore | null;

export function initStorage(
  config: AppConfig,
  logger: pino.Logger
): Storage {
  if (config.dataStore !== "sqlite") return null;
  const path = process.env.ARB_DB_PATH ?? config.storage.sqlitePath;
  logger.info({ path }, "initializing sqlite storage");
  return new SqliteStore(path);
}
