import type { CardRef, Era } from "@/lib/types";

/** Era boundaries by set release date (ISO yyyy-mm-dd, compared lexically). */
export const ERA_STARTS: ReadonlyArray<[Era, string]> = [
  ["modern", "2023-03-01"], // Scarlet & Violet
  ["sword-shield", "2020-01-01"],
  ["sun-moon", "2017-01-01"],
  ["xy", "2014-01-01"],
];

/**
 * Era of a card by release date. When no date is known, falls back to the
 * pokemontcg.io set-id prefix, and finally to "modern" (most scanned cards).
 */
export function eraOf(card: Pick<CardRef, "releaseDate" | "setId">): Era {
  const d = card.releaseDate?.replace(/\//g, "-");
  if (d && /^\d{4}-\d{2}/.test(d)) {
    for (const [era, start] of ERA_STARTS) if (d >= start) return era;
    return "older";
  }
  const id = (card.setId ?? "").toLowerCase();
  if (/^(sv|zsv|rsv|me)/.test(id)) return "modern";
  if (/^(swsh|cel25|pgo)/.test(id)) return "sword-shield";
  if (/^(sm|det1)/.test(id)) return "sun-moon";
  if (/^(xy|g1|dc1)/.test(id)) return "xy";
  if (id) return "older";
  return "modern";
}
