import { OrderRequest, OrderResult } from "../../types/index.js";

export interface CexAdapter {
  placeOrder(order: OrderRequest): Promise<OrderResult>;
}

export class SimulatedCexAdapter implements CexAdapter {
  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    return {
      orderId: `cex-${Date.now()}`,
      status: "filled",
      filledSize: order.size,
      avgPrice: order.limitPrice ?? 0
    };
  }
}
