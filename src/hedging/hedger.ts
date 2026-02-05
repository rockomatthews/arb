import pino from "pino";
import { Opportunity, OrderRequest } from "../types/index.js";
import { InventoryLedger } from "../inventory/ledger.js";
import { CexAdapter, SimulatedCexAdapter } from "../execution/adapters/cexAdapter.js";

export class HedgeService {
  private readonly ledger: InventoryLedger;
  private readonly cex: CexAdapter;
  private readonly logger: pino.Logger;

  constructor(ledger: InventoryLedger, logger: pino.Logger) {
    this.ledger = ledger;
    this.logger = logger;
    this.cex = new SimulatedCexAdapter();
  }

  async hedgeOpportunity(opportunity: Opportunity): Promise<boolean> {
    const request: OrderRequest = {
      venueId: "binance",
      base: opportunity.base,
      quote: opportunity.quote,
      side: "sell",
      size: opportunity.size,
      type: "market"
    };
    try {
      const result = await this.cex.placeOrder(request);
      if (result.status !== "filled") {
        this.logger.warn({ result }, "hedge failed");
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error({ err }, "hedge error");
      return false;
    }
  }
}
