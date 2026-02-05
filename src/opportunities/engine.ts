import { AppConfig } from "../config/index.js";
import { Opportunity, Quote } from "../types/index.js";

export function findOpportunities(
  quotes: Quote[],
  config: AppConfig
): Opportunity[] {
  const grouped = groupByPair(quotes);
  const results: Opportunity[] = [];
  for (const [pair, pairQuotes] of grouped.entries()) {
    const [base, quote] = pair.split("/");
    const buys = pairQuotes.filter((q) => q.side === "buy");
    const sells = pairQuotes.filter((q) => q.side === "sell");
    if (buys.length === 0 || sells.length === 0) continue;

    const bestBuy = buys.reduce((a, b) => (a.price < b.price ? a : b));
    const bestSell = sells.reduce((a, b) => (a.price > b.price ? a : b));

    const edgeBps = computeEdgeBps(bestBuy, bestSell);
    if (edgeBps < config.risk.minEdgeBps) continue;

    const size = Math.min(config.risk.maxNotionalUsd / bestBuy.price, 1);
    const expectedProfitUsd =
      (bestSell.price - bestBuy.price) * size -
      feeUsd(bestBuy, size) -
      feeUsd(bestSell, size);
    if (expectedProfitUsd <= 0) continue;

    results.push({
      id: `${pair}-${bestBuy.venueId}-${bestSell.venueId}-${Date.now()}`,
      buyVenueId: bestBuy.venueId,
      sellVenueId: bestSell.venueId,
      base,
      quote,
      buyPrice: bestBuy.price,
      sellPrice: bestSell.price,
      size,
      expectedEdgeBps: edgeBps,
      expectedProfitUsd,
      timestampMs: Date.now()
    });
  }
  return results;
}

function groupByPair(quotes: Quote[]): Map<string, Quote[]> {
  const map = new Map<string, Quote[]>();
  for (const q of quotes) {
    const key = `${q.base}/${q.quote}`;
    const bucket = map.get(key) ?? [];
    bucket.push(q);
    map.set(key, bucket);
  }
  return map;
}

function computeEdgeBps(buy: Quote, sell: Quote): number {
  if (buy.price <= 0) return 0;
  return ((sell.price - buy.price) / buy.price) * 10000;
}

function feeUsd(quote: Quote, size: number): number {
  return (quote.price * size * quote.feeBps) / 10000;
}
