import { OrderRequest, OrderResult } from "../../types/index.js";
import { privateKeyToAccount } from "viem/accounts";

type HyperliquidConfig = {
  apiUrl: string;
  coins: string[];
};

type AssetIndexMap = Map<string, number>;

export class HyperliquidAdapter {
  private readonly config: HyperliquidConfig;
  private assetMap: AssetIndexMap = new Map();

  constructor(config: HyperliquidConfig) {
    this.config = config;
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const privateKey = process.env.ARB_HL_PRIVATE_KEY;
    if (!privateKey) {
      return {
        orderId: `hl-${Date.now()}`,
        status: "failed",
        filledSize: 0,
        error: "ARB_HL_PRIVATE_KEY not set"
      };
    }
    const { HttpTransport, ExchangeClient, InfoClient } =
      (await import("@nktkas/hyperliquid")) as any;
    const wallet = privateKeyToAccount(privateKey as `0x${string}`);
    const transport = new HttpTransport({ url: this.config.apiUrl });
    const exchange = new ExchangeClient({ transport, wallet });
    const info = new InfoClient({ transport });

    if (!this.assetMap.size) {
      const meta = await info.meta();
      this.assetMap = buildAssetMap(meta);
    }

    const asset = this.assetMap.get(order.base);
    if (asset === undefined) {
      return {
        orderId: `hl-${Date.now()}`,
        status: "failed",
        filledSize: 0,
        error: `unknown asset ${order.base}`
      };
    }

    const price = (order.limitPrice ?? 0).toString();
    const size = order.size.toString();
    const result = await exchange.order({
      orders: [
        {
          a: asset,
          b: order.side === "buy",
          p: price,
          s: size,
          r: false,
          t: { limit: { tif: "Ioc" } },
          c: order.clientOrderId
        }
      ],
      grouping: "na"
    });

    const status = parseOrderStatus(result);
    return {
      orderId: status.orderId ?? `hl-${Date.now()}`,
      status: status.ok ? "filled" : "failed",
      filledSize: status.filledSize ?? 0,
      avgPrice: status.avgPrice ?? order.limitPrice,
      error: status.error
    };
  }
}

function buildAssetMap(meta: any): AssetIndexMap {
  const map: AssetIndexMap = new Map();
  const universe = meta?.universe ?? [];
  for (let i = 0; i < universe.length; i += 1) {
    const item = universe[i] ?? {};
    const name =
      item.name ?? item.coin ?? item.symbol ?? item.asset ?? undefined;
    if (name) map.set(String(name), i);
  }
  return map;
}

function parseOrderStatus(result: any): {
  ok: boolean;
  orderId?: string;
  filledSize?: number;
  avgPrice?: number;
  error?: string;
} {
  const statuses = result?.response?.data?.statuses ?? [];
  const first = statuses[0] ?? {};
  if (first?.filled) {
    return {
      ok: true,
      orderId: String(first.filled.oid),
      filledSize: Number(first.filled.totalSz ?? 0),
      avgPrice: Number(first.filled.avgPx ?? 0)
    };
  }
  if (first?.resting) {
    return { ok: true, orderId: String(first.resting.oid) };
  }
  if (first?.error) {
    return { ok: false, error: String(first.error) };
  }
  return { ok: false, error: "unknown response" };
}
