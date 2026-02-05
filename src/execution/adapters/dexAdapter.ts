import { OrderRequest, OrderResult } from "../../types/index.js";

export interface DexAdapter {
  placeOrder(order: OrderRequest): Promise<OrderResult>;
}

export class SimulatedDexAdapter implements DexAdapter {
  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    return {
      orderId: `dex-${Date.now()}`,
      status: "filled",
      filledSize: order.size,
      avgPrice: order.limitPrice ?? 0
    };
  }
}
