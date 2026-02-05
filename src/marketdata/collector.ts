import { EventEmitter } from "node:events";
import { Quote } from "../types/index.js";

export type CollectorStatus = "idle" | "running" | "stopped";

export class QuoteCollector extends EventEmitter {
  status: CollectorStatus = "idle";

  start(): void {
    this.status = "running";
    this.emit("status", this.status);
  }

  stop(): void {
    this.status = "stopped";
    this.emit("status", this.status);
  }

  protected emitQuote(quote: Quote): void {
    this.emit("quote", quote);
  }
}
