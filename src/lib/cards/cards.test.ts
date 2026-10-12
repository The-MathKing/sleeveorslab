import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLuceneQuery, parseQuery } from "./query";
import { inferFinish, toCardRef, toIsoDate, type RawPtcgCard } from "./map";
import { TTLCache } from "./cache";
import { __clearCardCaches, fetchRawCard, getCard, searchCards } from "./index";

describe("parseQuery / buildLuceneQuery", () => {
  const q = (s: string) => buildLuceneQuery(parseQuery(s));
  it("name + number", () => expect(q("charizard 199")).toBe("name:charizard* number:199"));
  it("number/total", () => expect(q("pikachu 25/102")).toBe("name:pikachu* number:25 set.printedTotal:102"));
  it("leading zeros + hash", () => expect(q("Pikachu #025/102")).toBe("name:pikachu* number:25 set.printedTotal:102"));
  it("nickname", () => expect(q("moonbreon")).toBe("name:umbreon* name:vmax* number:215 set.id:swsh7"));
  it("set id + number", () => expect(q("sv3pt5 199")).toBe("number:199 set.id:sv3pt5"));
  it("ptcgo code only when caps", () => {
    expect(q("umbreon OBF")).toBe("name:umbreon* set.ptcgoCode:OBF");
    expect(q("mew 151")).toBe("name:mew* number:151");
    expect(q("MEW 151")).toBe("name:mew* number:151");
  });
  it("trainer gallery numbers", () => expect(q("pikachu TG05")).toBe("name:pikachu* number:TG05"));
  it("multi-word names and punctuation", () => {
    expect(q("Mr. Mime")).toBe("name:mr* name:mime*");
    expect(q("charizard ex")).toBe("name:charizard* name:ex*");
    expect(q("Farfetch'd")).toBe("name:farfetchd*");
  });
  it("strips lucene syntax", () => expect(q('name:(x) OR "y"')).not.toMatch(/[()"]/));
});

describe("finish + mapping", () => {
  it("infers finish", () => {
    expect(inferFinish({ rarity: "Special Illustration Rare" })).toBe("full-art");
    expect(inferFinish({ rarity: "Illustration Rare" })).toBe("full-art");
    expect(inferFinish({ rarity: "Hyper Rare" })).toBe("full-art");
    expect(inferFinish({ rarity: "Rare Holo V" })).toBe("holo");
    expect(inferFinish({ rarity: "Rare Holo" })).toBe("holo");
    expect(inferFinish({ rarity: "Common" })).toBe("non-holo");
    expect(inferFinish({ rarity: "Rare" })).toBe("non-holo");
    expect(inferFinish({ rarity: "Promo", tcgplayer: { prices: { holofoil: { market: 1 } } } })).toBe("holo");
    expect(inferFinish({})).toBe("unknown");
  });
  it("converts dates", () => {
    expect(toIsoDate("2023/09/22")).toBe("2023-09-22");
    expect(toIsoDate("1999/1/9")).toBe("1999-01-09");
    expect(toIsoDate("nope")).toBeUndefined();
  });
  it("maps to CardRef", () => {
    expect(toCardRef(SAMPLE)).toEqual({
      id: "sv3pt5-199",
      name: "Charizard ex",
      setId: "sv3pt5",
      setName: "151",
      number: "199",
      rarity: "Special Illustration Rare",
      releaseDate: "2023-09-22",
      imageSmall: "https://images.pokemontcg.io/sv3pt5/199.png",
      imageLarge: "https://images.pokemontcg.io/sv3pt5/199_hires.png",
      finish: "full-art",
    });
  });
});

describe("TTLCache", () => {
  it("expires and evicts LRU", () => {
    let t = 0;
    const c = new TTLCache<string, number>(2, 100, () => t);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    t = 200;
    expect(c.get("a")).toBeUndefined();
  });
});

export const SAMPLE: RawPtcgCard = {
  id: "sv3pt5-199",
  name: "Charizard ex",
  number: "199",
  rarity: "Special Illustration Rare",
  subtypes: ["Stage 2", "ex"],
  set: { id: "sv3pt5", name: "151", printedTotal: 165, releaseDate: "2023/09/22" },
  images: {
    small: "https://images.pokemontcg.io/sv3pt5/199.png",
    large: "https://images.pokemontcg.io/sv3pt5/199_hires.png",
  },
  tcgplayer: { prices: { holofoil: { low: 295, mid: 360, market: 320.91 } } },
};

describe("network functions (mocked fetch)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    __clearCardCaches();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("searchCards builds the request and maps results", async () => {
    vi.stubEnv("POKEMONTCG_API_KEY", "k123");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [SAMPLE] })));
    const cards = await searchCards("charizard 199", { limit: 5 });
    expect(cards).toHaveLength(1);
    expect(cards[0].finish).toBe("full-art");
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(String(url));
    expect(u.searchParams.get("q")).toBe("name:charizard* number:199");
    expect(u.searchParams.get("orderBy")).toBe("-set.releaseDate");
    // name queries fetch a wider candidate pool, re-ranked locally, then trimmed to `limit`
    expect(u.searchParams.get("pageSize")).toBe("100");
    expect(init.headers["X-Api-Key"]).toBe("k123");
    // cached: second call doesn't hit the network; raw card cache is warmed too
    await searchCards("charizard 199", { limit: 5 });
    expect(await fetchRawCard("sv3pt5-199")).toEqual(SAMPLE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a name-only query when the number finds nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [SAMPLE] })));
    const cards = await searchCards("charizard 9999");
    expect(cards).toHaveLength(1);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("q")).toBe("name:charizard*");
  });

  it("empty query makes no request", async () => {
    expect(await searchCards("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getCard returns null on 404 and rejects bad ids without fetching", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await getCard("sv3pt5-9999")).toBeNull();
    expect(await getCard("../etc/passwd")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws CardProviderError on 5xx / network failure", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 503 }));
    await expect(searchCards("pikachu")).rejects.toThrow(/Card provider/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getCard("base1-4")).rejects.toThrow(/unreachable/);
  });

  it("retries transient 5xx", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: SAMPLE })));
    expect((await getCard("sv3pt5-199"))?.id).toBe("sv3pt5-199");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
