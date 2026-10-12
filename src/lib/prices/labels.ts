// Client-safe helpers (no env, no network). UI may import this file directly:
//   import { priceSourceLabel } from "@/lib/prices/labels";
import type { PriceQuote } from "@/lib/types";

export function priceSourceLabel(source: PriceQuote["source"]): string {
  switch (source) {
    case "pricecharting":
      return "PriceCharting sold listings";
    case "tcgplayer-via-pokemontcg":
      return "TCGplayer market price (via pokemontcg.io)";
    case "manual":
      return "Entered manually";
    case "estimate":
    default:
      return "Estimate (no market data found)";
  }
}

/** True when the UI must show an "estimate" badge next to graded prices. */
export function gradedNeedsEstimateLabel(q: Pick<PriceQuote, "gradedIsEstimate" | "graded">): boolean {
  return q.gradedIsEstimate || Object.keys(q.graded ?? {}).length === 0;
}
