import pino from "pino";
import { AppConfig } from "../config/index.js";
import { Opportunity, OrderRequest, OrderResult } from "../types/index.js";
import { KillSwitch } from "../risk/killSwitch.js";
import { isOpportunityAllowed } from "../risk/guards.js";
import { buildAdapterMap, AdapterMap } from "./registry.js";

export class ExecutionEngine {
  private readonly logger: pino.Logger;
  private readonly config: AppConfig;
  private readonly killSwitch = new KillSwitch();
  private readonly adapters: AdapterMap;

  constructor(config: AppConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;
    this.adapters = buildAdapterMap(config);
  }

  async execute(opportunity: Opportunity): Promise<OrderResult[]> {
    if (this.killSwitch.isTripped()) {
      this.logger.error("kill switch tripped; refusing execution");
      return [];
    }
    if (!isOpportunityAllowed(opportunity, this.config)) {
      this.logger.info({ opportunity }, "opportunity blocked by risk");
      return [];
    }
    try {
      const buyRequest: OrderRequest = {
        venueId: opportunity.buyVenueId,
        base: opportunity.base,
        quote: opportunity.quote,
        side: "buy",
        size: opportunity.size,
        type: "market",
        limitPrice: opportunity.buyPrice,
        clientOrderId: `buy-${opportunity.id}`
      };
      const sellRequest: OrderRequest = {
        venueId: opportunity.sellVenueId,
        base: opportunity.base,
        quote: opportunity.quote,
        side: "sell",
        size: opportunity.size,
        type: "market",
        limitPrice: opportunity.sellPrice,
        clientOrderId: `sell-${opportunity.id}`
      };
      const buyAdapter = this.resolveAdapter(buyRequest.venueId);
      const sellAdapter = this.resolveAdapter(sellRequest.venueId);
      if (!buyAdapter || !sellAdapter) {
        this.logger.warn(
          { buyVenue: buyRequest.venueId, sellVenue: sellRequest.venueId },
          "missing adapter for venue"
        );
        return [];
      }
      const buy = await buyAdapter.placeOrder(buyRequest);
      if (buy.status !== "filled") return [buy];
      const sell = await sellAdapter.placeOrder(sellRequest);
      return [buy, sell];
    } catch (err) {
      this.killSwitch.recordError();
      this.logger.error({ err }, "execution failed");
      return [];
    }
  }

  private resolveAdapter(venueId: string): {
    placeOrder: (order: OrderRequest) => Promise<OrderResult>;
  } | null {
    const adapter = this.adapters[venueId];
    if (!adapter) return null;
    const candidate = adapter as {
      placeOrder?: (order: OrderRequest) => Promise<OrderResult>;
    };
    if (typeof candidate.placeOrder !== "function") return null;
    return candidate as {
      placeOrder: (order: OrderRequest) => Promise<OrderResult>;
    };
  }
}
