export type VenueType = "cex" | "dex";
export type ChainType = "evm" | "solana";

export type Venue = {
  id: string;
  name: string;
  type: VenueType;
  chain?: ChainType;
};

export type QuoteSide = "buy" | "sell";

export type Quote = {
  venueId: string;
  base: string;
  quote: string;
  side: QuoteSide;
  price: number;
  size: number;
  feeBps: number;
  timestampMs: number;
  confidence: number;
  metadata?: Record<string, unknown>;
};

export type OrderType = "market" | "limit";
export type OrderStatus = "new" | "filled" | "partially_filled" | "failed";

export type OrderRequest = {
  venueId: string;
  base: string;
  quote: string;
  side: QuoteSide;
  size: number;
  type: OrderType;
  limitPrice?: number;
  clientOrderId?: string;
};

export type OrderResult = {
  orderId: string;
  status: OrderStatus;
  filledSize: number;
  avgPrice?: number;
  feeUsd?: number;
  error?: string;
  txHash?: string;
};

export type Trade = {
  id: string;
  venueId: string;
  base: string;
  quote: string;
  side: QuoteSide;
  size: number;
  price: number;
  feeUsd: number;
  timestampMs: number;
};

export type Balance = {
  asset: string;
  free: number;
  locked: number;
};

export type Opportunity = {
  id: string;
  buyVenueId: string;
  sellVenueId: string;
  base: string;
  quote: string;
  buyPrice: number;
  sellPrice: number;
  size: number;
  expectedEdgeBps: number;
  expectedProfitUsd: number;
  timestampMs: number;
};
