import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRef } from "@/lib/types";
import { __clearCardCaches } from "@/lib/cards";
import { __clearPriceCache, getPrice, mapPriceChartingProduct, pickTcgplayerRaw } from "./index";
import { productMatchesCard } from "./pricecharting";

const CARD: CardRef = { id: "sv3pt5-199", name: "Charizard ex", setId: "sv3pt5", setName: "151", number: "199", finish: "full-art" };
const RAW = {
  id: "sv3pt5-199",
  name: "Charizard ex",
  number: "199",
  rarity: "Special Illustration Rare",
  set: { id: "sv3pt5", name: "151", releaseDate: "2023/09/22" },
  tcgplayer: { prices: { holofoil: { mid: 360, market: 320.91 }, normal: { market: 1 } } },
};

describe("pure mapping", () => {
  it("maps PriceCharting pennies", () => {
    const q = mapPriceChartingProduct(
      {
        status: "success",
        "loose-price": 32091,
        "graded-price": 60000,
        "manual-only-price": 150000,
        "condition-17-price": 120000,
        "condition-18-price": 90000,
        "box-only-price": 80000,
        "bgs-10-price": 0,
      },
      "x",
      "t",
    );
    expect(q.raw).toBe(320.91);
    expect(q.graded).toEqual({ PSA: { 9: 600, 10: 1500 }, CGC: { 10: 1200 } });
    expect(q.source).toBe("pricecharting");
    expect(q.gradedIsEstimate).toBe(false);
  });
  it("rejects a mismatched PriceCharting printing", () => {
    expect(productMatchesCard({ "product-name": "Charizard ex #199" }, CARD)).toBe(true);
    expect(productMatchesCard({ "product-name": "Charizard ex #006" }, CARD)).toBe(false);
    expect(productMatchesCard({ "product-name": "Pikachu #025" }, { ...CARD, number: "25" })).toBe(true);
  });
  it("picks tcgplayer variant by finish, market then mid", () => {
    expect(pickTcgplayerRaw(RAW, "full-art")).toEqual({ usd: 320.91, variant: "holofoil" });
    expect(pickTcgplayerRaw(RAW, "non-holo")).toEqual({ usd: 1, variant: "normal" });
    expect(pickTcgplayerRaw({ tcgplayer: { prices: { reverseHolofoil: { mid: 2.5, market: null } } } }, "holo")).toEqual({
      usd: 2.5,
      variant: "reverseHolofoil",
    });
    expect(pickTcgplayerRaw({}, "holo")).toBeUndefined();
  });
});

describe("getPrice chain (mocked fetch)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    __clearCardCaches();
    __clearPriceCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses PriceCharting when the key is set", async () => {
    vi.stubEnv("PRICECHARTING_API_KEY", "pc");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "success", "product-name": "Charizard ex #199", "loose-price": 30000, "manual-only-price": 100000 })),
    );
    const q = await getPrice(CARD);
    expect(q).toMatchObject({ source: "pricecharting", raw: 300, graded: { PSA: { 10: 1000 } }, gradedIsEstimate: false });
    expect(String(fetchMock.mock.calls[0][0])).toContain("pricecharting.com/api/product");
  });

  it("degrades to tcgplayer when PriceCharting fails", async () => {
    vi.stubEnv("PRICECHARTING_API_KEY", "pc");
    fetchMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: RAW })));
    const q = await getPrice(CARD);
    expect(q).toMatchObject({ source: "tcgplayer-via-pokemontcg", raw: 320.91, graded: {}, gradedIsEstimate: true });
  });

  it("uses tcgplayer without a PriceCharting key, and caches", async () => {
    vi.stubEnv("PRICECHARTING_API_KEY", "");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: RAW })));
    expect((await getPrice(CARD)).source).toBe("tcgplayer-via-pokemontcg");
    await getPrice(CARD);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an estimate quote and never throws when everything fails", async () => {
    vi.stubEnv("PRICECHARTING_API_KEY", "");
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    const q = await getPrice(CARD);
    expect(q).toMatchObject({ cardId: CARD.id, source: "estimate", graded: {}, gradedIsEstimate: true });
    expect(q.raw).toBeUndefined();
  });
});
