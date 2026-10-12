import type { CardRef, GraderId, Grade, PriceQuote } from "@/lib/types";

/**
 * PriceCharting product API: GET https://www.pricecharting.com/api/product?t=KEY&q=...
 * All price fields are integers in US pennies. For trading cards PriceCharting reuses its
 * video-game field names; the mapping we apply is:
 *
 *   loose-price         → raw (ungraded)
 *   cib-price           → Grade 7  (any grader; mapped to PSA 7)
 *   new-price           → Grade 8  (any grader; mapped to PSA 8)
 *   graded-price        → Grade 9  (≈ PSA 9)
 *   box-only-price      → Grade 9.5 (BGS/CGC 9.5) — NOT mapped: Grade is integer-only
 *   manual-only-price   → PSA 10
 *   bgs-10-price        → BGS 10   — NOT mapped: BGS isn't a GraderId
 *   condition-17-price  → CGC 10
 *   condition-18-price  → SGC 10   — NOT mapped: SGC isn't a GraderId
 *
 * Zero/missing fields are treated as "no data" and omitted.
 */
export interface PriceChartingProduct {
  status?: string;
  "error-message"?: string;
  id?: string;
  "product-name"?: string;
  "console-name"?: string;
  "loose-price"?: number;
  "cib-price"?: number;
  "new-price"?: number;
  "graded-price"?: number;
  "box-only-price"?: number;
  "manual-only-price"?: number;
  "bgs-10-price"?: number;
  "condition-17-price"?: number;
  "condition-18-price"?: number;
}

const FIELD_MAP: Array<[keyof PriceChartingProduct, GraderId, Grade]> = [
  ["cib-price", "PSA", 7],
  ["new-price", "PSA", 8],
  ["graded-price", "PSA", 9],
  ["manual-only-price", "PSA", 10],
  ["condition-17-price", "CGC", 10],
];

function pennies(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.round(v) / 100;
}

export function buildPriceChartingQuery(card: CardRef): string {
  return `pokemon ${card.setName} ${card.name} #${card.number}`.replace(/\s+/g, " ").trim();
}

/**
 * PriceCharting's /product endpoint returns its single best match, which can be the wrong
 * printing. If the product name carries a "#number", require it to match ours.
 */
export function productMatchesCard(p: PriceChartingProduct, card: CardRef): boolean {
  const name = p["product-name"] ?? "";
  const m = /#\s*([A-Za-z]*\d+[A-Za-z]?)/.exec(name);
  if (!m) return true;
  const norm = (s: string) => s.replace(/^([A-Za-z]*)0+(\d)/, "$1$2").toLowerCase();
  return norm(m[1]) === norm(card.number);
}

export function mapPriceChartingProduct(
  p: PriceChartingProduct,
  cardId: string,
  asOf: string,
): PriceQuote {
  const graded: PriceQuote["graded"] = {};
  for (const [field, grader, grade] of FIELD_MAP) {
    const usd = pennies(p[field]);
    if (usd === undefined) continue;
    (graded[grader] ??= {})[grade] = usd;
  }
  const quote: PriceQuote = {
    cardId,
    graded,
    source: "pricecharting",
    asOf,
    gradedIsEstimate: Object.keys(graded).length === 0,
  };
  const raw = pennies(p["loose-price"]);
  if (raw !== undefined) quote.raw = raw;
  return quote;
}
