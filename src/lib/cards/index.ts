// Card search via pokemontcg.io v2 (server-side; key from env when present).
// Contract: searchCards(q, opts) and getCard(id). Extra exports are internal helpers
// for src/lib/prices and tests.
import type { CardRef } from "@/lib/types";
import { TTLCache } from "./cache";
import { toCardRef, type RawPtcgCard } from "./map";
import { buildLuceneQuery, isEmptyQuery, parseQuery } from "./query";
import { rankCards } from "./rank";

export { parseQuery, buildLuceneQuery } from "./query";
export { inferFinish, toCardRef, toIsoDate } from "./map";
export type { RawPtcgCard, TcgPlayerPriceBlock } from "./map";
export { rankCards, nameTier, normalizeName, NameTier } from "./rank";

const API_BASE = "https://api.pokemontcg.io/v2";
const TIMEOUT_MS = 6_000;
const TTL_MS = 10 * 60 * 1000;
const SELECT_FIELDS = "id,name,number,rarity,subtypes,supertype,set,images,tcgplayer";
/**
 * The provider can only sort by a field (newest set first), so name queries fetch a wider
 * candidate pool that we re-rank locally (exact name > starts-with > contains) before trimming
 * to `limit`. Otherwise plain "Pikachu" can sit behind dozens of newer "Pikachu ex"/tag-team cards.
 */
const NAME_CANDIDATE_POOL = 100;

/** Thrown when the upstream provider fails (network, timeout, 5xx). Routes map it to 502. */
export class CardProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CardProviderError";
  }
}

const searchCache = new TTLCache<string, RawPtcgCard[]>(500, TTL_MS);
const cardCache = new TTLCache<string, RawPtcgCard | null>(2_000, TTL_MS);

/** For tests. */
export function __clearCardCaches(): void {
  searchCache.clear();
  cardCache.clear();
}

/** pokemontcg.io ids look like "sv3pt5-199", "swsh12pt5gg-GG44", "base1-4". */
export function isValidCardId(id: string): boolean {
  return /^[A-Za-z0-9.]{1,32}-[A-Za-z0-9.-]{1,16}$/.test(id);
}

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET against pokemontcg.io with a 6s overall deadline (AbortController) shared across
 * attempts. The API returns transient 500/502s fairly often, so 5xx/429 and network errors
 * are retried (up to 4 attempts) while time remains.
 */
async function ptcgFetch(path: string, params?: Record<string, string>): Promise<Response> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.POKEMONTCG_API_KEY;
  if (key) headers["X-Api-Key"] = key;

  const ctrl = new AbortController();
  const deadline = Date.now() + TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let last: Response | undefined;
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        last = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
        if (last.status < 500 && last.status !== 429) return last;
      } catch (err) {
        if ((err as Error)?.name === "AbortError" || ctrl.signal.aborted) {
          throw new CardProviderError("Card provider timed out");
        }
        last = undefined;
      }
      const backoff = 100 * attempt;
      if (attempt === MAX_ATTEMPTS || Date.now() + backoff + 500 > deadline) break;
      await sleep(backoff);
    }
  } finally {
    clearTimeout(timer);
  }
  if (last) return last;
  throw new CardProviderError("Card provider unreachable");
}

async function rawSearch(q: string, pageSize: number): Promise<RawPtcgCard[]> {
  const cacheKey = `${q}|${pageSize}`;
  const hit = searchCache.get(cacheKey);
  if (hit) return hit;

  const res = await ptcgFetch("/cards", {
    q,
    pageSize: String(pageSize),
    orderBy: "-set.releaseDate",
    select: SELECT_FIELDS,
  });
  if (!res.ok) {
    // 400 = query the provider couldn't parse; treat as "no results" rather than an outage.
    if (res.status === 400 || res.status === 404) return [];
    throw new CardProviderError(`Card provider returned ${res.status}`, res.status);
  }
  const json = (await res.json()) as { data?: RawPtcgCard[] };
  const data = Array.isArray(json.data) ? json.data : [];
  searchCache.set(cacheKey, data);
  for (const c of data) if (c?.id) cardCache.set(c.id, c);
  return data;
}

export async function searchCards(q: string, opts?: { limit?: number }): Promise<CardRef[]> {
  const limit = Math.min(Math.max(Math.trunc(opts?.limit ?? 20), 1), 50);
  const parsed = parseQuery(q ?? "");
  if (isEmptyQuery(parsed)) return [];

  const pageSize = parsed.nameTokens.length ? Math.max(limit, NAME_CANDIDATE_POOL) : limit;
  let results = await rawSearch(buildLuceneQuery(parsed), pageSize);
  // "charizard 4" with a typo'd number: fall back to name (+set) only.
  if (results.length === 0 && (parsed.number || parsed.printedTotal) && parsed.nameTokens.length) {
    results = await rawSearch(buildLuceneQuery(parsed, { includeNumber: false }), pageSize);
  }
  const printedTotals = new Map(results.map((r) => [r.id, r.set?.printedTotal]));
  return rankCards(results.map(toCardRef), parsed, printedTotals).slice(0, limit);
}

/**
 * Internal: provider JSON for one card (includes the tcgplayer price block).
 * Returns null when the card doesn't exist. Throws CardProviderError on outage.
 */
export async function fetchRawCard(id: string): Promise<RawPtcgCard | null> {
  if (!isValidCardId(id)) return null;
  const cached = cardCache.get(id);
  if (cached !== undefined) return cached;

  const res = await ptcgFetch(`/cards/${encodeURIComponent(id)}`, { select: SELECT_FIELDS });
  if (res.status === 404 || res.status === 400) {
    cardCache.set(id, null, 60_000);
    return null;
  }
  if (!res.ok) throw new CardProviderError(`Card provider returned ${res.status}`, res.status);
  const json = (await res.json()) as { data?: RawPtcgCard };
  const card = json.data ?? null;
  cardCache.set(id, card);
  return card;
}

export async function getCard(id: string): Promise<CardRef | null> {
  const raw = await fetchRawCard(id);
  return raw ? toCardRef(raw) : null;
}
