import { Quote } from "../types/index.js";
import { Storage } from "../storage/index.js";

export class QuoteStore {
  private quotes: Quote[] = [];
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  add(quote: Quote): void {
    this.quotes.push(quote);
    if (this.storage) {
      this.storage.insertQuote(quote);
    }
  }

  latestByPair(base: string, quote: string): Quote[] {
    return this.quotes.filter(
      (q) => q.base === base && q.quote === quote
    );
  }

  all(): Quote[] {
    return [...this.quotes];
  }
}
