import type { Finish } from "@/lib/types";
import type { RawPtcgCard, TcgPlayerPriceBlock } from "@/lib/cards/map";

/** Variant preference per finish. Falls through to any variant with a price. */
const PREFERENCE: Record<Finish, string[]> = {
  holo: ["holofoil", "unlimitedHolofoil", "1stEditionHolofoil"],
  "full-art": ["holofoil", "unlimitedHolofoil", "1stEditionHolofoil"],
  "reverse-holo": ["reverseHolofoil"],
  "non-holo": ["normal", "unlimited", "unlimitedNormal", "1stEditionNormal", "1stEdition"],
  unknown: [],
};
const FALLBACK = ["holofoil", "normal", "reverseHolofoil", "unlimitedHolofoil", "unlimited", "1stEditionHolofoil", "1stEditionNormal", "1stEdition"];

function value(b?: TcgPlayerPriceBlock): number | undefined {
  if (!b) return undefined;
  for (const v of [b.market, b.mid]) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v * 100) / 100;
  }
  return undefined;
}

/** Pick the TCGplayer raw (ungraded NM) price matching the card's finish: market, then mid. */
export function pickTcgplayerRaw(
  raw: Pick<RawPtcgCard, "tcgplayer">,
  finish: Finish = "unknown",
): { usd: number; variant: string } | undefined {
  const prices = raw.tcgplayer?.prices;
  if (!prices) return undefined;
  const order = [...PREFERENCE[finish], ...FALLBACK, ...Object.keys(prices)];
  for (const variant of order) {
    const usd = value(prices[variant]);
    if (usd !== undefined) return { usd, variant };
  }
  return undefined;
}
