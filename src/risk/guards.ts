import { AppConfig } from "../config/index.js";
import { Opportunity } from "../types/index.js";

export function isOpportunityAllowed(
  opportunity: Opportunity,
  config: AppConfig
): boolean {
  if (opportunity.expectedEdgeBps < config.risk.minEdgeBps) return false;
  if (
    opportunity.size * opportunity.buyPrice >
    config.risk.maxNotionalUsd
  )
    return false;
  return true;
}
