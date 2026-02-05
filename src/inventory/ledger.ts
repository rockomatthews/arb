import { Balance, Trade } from "../types/index.js";

export class InventoryLedger {
  private balances: Map<string, Balance> = new Map();

  getBalance(asset: string): Balance {
    return (
      this.balances.get(asset) ?? { asset, free: 0, locked: 0 }
    );
  }

  setBalance(balance: Balance): void {
    this.balances.set(balance.asset, balance);
  }

  applyTrade(trade: Trade): void {
    const base = this.getBalance(trade.base);
    const quote = this.getBalance(trade.quote);

    if (trade.side === "buy") {
      base.free += trade.size;
      quote.free -= trade.size * trade.price;
    } else {
      base.free -= trade.size;
      quote.free += trade.size * trade.price;
    }

    this.setBalance(base);
    this.setBalance(quote);
  }

  snapshot(): Balance[] {
    return Array.from(this.balances.values());
  }
}
