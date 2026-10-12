/**
 * Re-rank provider search results. pokemontcg.io can only order by a field (we ask for
 * newest set first), so "pikachu" returns "Pikachu & Zekrom-GX" ahead of plain "Pikachu".
 *
 * Sort key, most significant first:
 *   1. collector number match (only when the query has a number)
 *   2. printed-total match (only when the query has "25/102"-style total)
 *   3. name tier: exact → starts with the query words → starts with the query text → contains → other
 *   4. newest release first
 *   5. original provider order (stable)
 * Pure function, no network.
 */
import type { CardRef } from "@/lib/types";
import { normalizeNumber, type ParsedQuery } from "./query";

/** Lowercase, strip accents (Pokémon → pokemon), punctuation → spaces, collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const NameTier = {
  Exact: 0,
  WordPrefix: 1, // "pikachu" → "Pikachu ex", "Pikachu & Zekrom-GX"
  TextPrefix: 2, // "char" → "Charizard"
  Contains: 3, // "pikachu" → "Ash's Pikachu", "Detective Pikachu"
  Other: 4,
} as const;
export type NameTier = (typeof NameTier)[keyof typeof NameTier];

export function nameTier(cardName: string, nameTokens: string[]): NameTier {
  if (!nameTokens.length) return NameTier.Other;
  const name = normalizeName(cardName);
  const query = normalizeName(nameTokens.join(" "));
  if (!query) return NameTier.Other;
  if (name === query) return NameTier.Exact;
  if (name.startsWith(query + " ")) return NameTier.WordPrefix;
  if (name.startsWith(query)) return NameTier.TextPrefix;
  const words = name.split(" ");
  const qWords = query.split(" ");
  if (qWords.every((q) => words.some((w) => w.startsWith(q)))) return NameTier.Contains;
  return NameTier.Other;
}

function sameNumber(cardNumber: string, queryNumber: string): boolean {
  return normalizeNumber(cardNumber).toUpperCase() === normalizeNumber(queryNumber).toUpperCase();
}

export function rankCards(cards: CardRef[], parsed: ParsedQuery, printedTotals?: Map<string, number | undefined>): CardRef[] {
  const keyed = cards.map((card, index) => {
    const numberMiss = parsed.number ? (sameNumber(card.number ?? "", parsed.number) ? 0 : 1) : 0;
    const total = printedTotals?.get(card.id);
    const totalMiss = parsed.printedTotal && total !== undefined ? (String(total) === parsed.printedTotal ? 0 : 1) : 0;
    return { card, index, numberMiss, totalMiss, tier: nameTier(card.name ?? "", parsed.nameTokens), date: card.releaseDate ?? "" };
  });
  keyed.sort(
    (a, b) =>
      a.numberMiss - b.numberMiss ||
      a.totalMiss - b.totalMiss ||
      a.tier - b.tier ||
      (a.date === b.date ? 0 : a.date < b.date ? 1 : -1) ||
      a.index - b.index,
  );
  return keyed.map((k) => k.card);
}
