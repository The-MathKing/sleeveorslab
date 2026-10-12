// Price provider chain: PriceCharting (if key) -> pokemontcg.io TCGplayer raw -> estimate.
// Never throws on provider failure; each step degrades to the next.
import type { CardRef, PriceQuote } from "@/lib/types";
import { fetchRawCard, inferFinish } from "@/lib/cards";
import { TTLCache } from "@/lib/cards/cache";
import {
  buildPriceChartingQuery,
  mapPriceChartingProduct,
  productMatchesCard,
  type PriceChartingProduct,
} from "./pricecharting";
import { pickTcgplayerRaw } from "./tcgplayer";

export { priceSourceLabel, gradedNeedsEstimateLabel } from "./labels";
export { mapPriceChartingProduct, pickTcgplayerRaw };

const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 6_000;
const priceCache = new TTLCache<string, PriceQuote>(2_000, TTL_MS);

/** For tests. */
export function __clearPriceCache(): void {
  priceCache.clear();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(timer);
  }
}

async function fromPriceCharting(card: CardRef, key: string, asOf: string): Promise<PriceQuote | null> {
  try {
    const url = new URL("https://www.pricecharting.com/api/product");
    url.searchParams.set("t", key);
    url.searchParams.set("q", buildPriceChartingQuery(card));
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) return null;
    const p = (await res.json()) as PriceChartingProduct;
    if (p.status && p.status !== "success") return null;
    if (!productMatchesCard(p, card)) return null;
    const q = mapPriceChartingProduct(p, card.id, asOf);
    if (q.raw === undefined && Object.keys(q.graded).length === 0) return null;
    return q;
  } catch {
    return null;
  }
}

async function tcgplayerRaw(card: CardRef): Promise<number | undefined> {
  try {
    const raw = await fetchRawCard(card.id);
    if (!raw) return undefined;
    const finish = card.finish && card.finish !== "unknown" ? card.finish : inferFinish(raw);
    return pickTcgplayerRaw(raw, finish)?.usd;
  } catch {
    return undefined;
  }
}

export async function getPrice(card: CardRef): Promise<PriceQuote> {
  const cacheKey = `${card.id}|${card.finish ?? ""}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;

  const asOf = new Date().toISOString();
  let quote: PriceQuote | null = null;

  const pcKey = process.env.PRICECHARTING_API_KEY;
  if (pcKey) {
    quote = await fromPriceCharting(card, pcKey, asOf);
    if (quote && quote.raw === undefined) {
      const raw = await tcgplayerRaw(card);
      if (raw !== undefined) quote.raw = raw;
    }
  }

  if (!quote) {
    const raw = await tcgplayerRaw(card);
    if (raw !== undefined) {
      quote = { cardId: card.id, raw, graded: {}, source: "tcgplayer-via-pokemontcg", asOf, gradedIsEstimate: true };
    }
  }

  if (!quote) {
    quote = { cardId: card.id, graded: {}, source: "estimate", asOf, gradedIsEstimate: true };
    // Short TTL for the empty result so a transient outage doesn't stick for an hour.
    priceCache.set(cacheKey, quote, 5 * 60 * 1000);
    return quote;
  }
  priceCache.set(cacheKey, quote);
  return quote;
}
