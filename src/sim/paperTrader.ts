import { Opportunity } from "../types/index.js";

export type PaperTrade = {
  opportunityId: string;
  executedAtMs: number;
  size: number;
  expectedProfitUsd: number;
};

export class PaperTrader {
  private trades: PaperTrade[] = [];
  private pnlUsd = 0;

  execute(opportunity: Opportunity): PaperTrade {
    const trade: PaperTrade = {
      opportunityId: opportunity.id,
      executedAtMs: Date.now(),
      size: opportunity.size,
      expectedProfitUsd: opportunity.expectedProfitUsd
    };
    this.trades.push(trade);
    this.pnlUsd += opportunity.expectedProfitUsd;
    return trade;
  }

  getPnlUsd(): number {
    return this.pnlUsd;
  }

  allTrades(): PaperTrade[] {
    return [...this.trades];
  }
}
