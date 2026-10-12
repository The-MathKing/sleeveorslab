import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRef } from "@/lib/types";
import type { RawPtcgCard } from "./map";
import { parseQuery } from "./query";
import { NameTier, nameTier, normalizeName, rankCards } from "./rank";
import { __clearCardCaches, searchCards } from "./index";

function card(id: string, name: string, number: string, releaseDate?: string): CardRef {
  return { id, name, number, setId: id.split("-")[0], setName: "Set", finish: "unknown", ...(releaseDate ? { releaseDate } : {}) };
}

function raw(id: string, name: string, number: string, releaseDate: string, printedTotal?: number): RawPtcgCard {
  return { id, name, number, set: { id: id.split("-")[0], name: "Set", releaseDate, printedTotal } };
}

const names = (cs: CardRef[]) => cs.map((c) => c.name);
const ids = (cs: CardRef[]) => cs.map((c) => c.id);

describe("normalizeName / nameTier", () => {
  it("normalizes accents and punctuation", () => {
    expect(normalizeName("Pokémon Center Lady")).toBe("pokemon center lady");
    expect(normalizeName("Pikachu & Zekrom-GX")).toBe("pikachu zekrom gx");
    expect(normalizeName("Farfetch'd")).toBe("farfetchd");
    expect(normalizeName("Mr. Mime")).toBe("mr mime");
  });
  it("tiers", () => {
    expect(nameTier("Pikachu", ["pikachu"])).toBe(NameTier.Exact);
    expect(nameTier("Mr. Mime", ["mr", "mime"])).toBe(NameTier.Exact);
    expect(nameTier("Charizard ex", ["charizard", "ex"])).toBe(NameTier.Exact);
    expect(nameTier("Pikachu & Zekrom-GX", ["pikachu"])).toBe(NameTier.WordPrefix);
    expect(nameTier("Pikachu ex", ["pikachu"])).toBe(NameTier.WordPrefix);
    expect(nameTier("Charizard", ["char"])).toBe(NameTier.TextPrefix);
    expect(nameTier("Ash's Pikachu", ["pikachu"])).toBe(NameTier.Contains);
    expect(nameTier("Raichu", ["pikachu"])).toBe(NameTier.Other);
  });
});

describe("rankCards", () => {
  // Provider order: newest set first.
  const provider = [
    card("sv8-238", "Pikachu ex", "238", "2024-11-08"),
    card("sv3pt5-173", "Ash's Pikachu", "173", "2023-09-22"),
    card("sm9-33", "Pikachu & Zekrom-GX", "33", "2019-02-01"),
    card("swsh45sv-SV107", "Pikachu", "SV107", "2021-02-19"),
    card("sv1-62", "Pikachu", "62", "2023-03-31"),
    card("base1-58", "Pikachu", "58", "1999-01-09"),
  ];

  it("exact name first, then starts-with, then contains; newest first within each", () => {
    const out = rankCards(provider, parseQuery("pikachu"));
    expect(ids(out)).toEqual(["sv1-62", "swsh45sv-SV107", "base1-58", "sv8-238", "sm9-33", "sv3pt5-173"]);
    expect(names(out).indexOf("Pikachu")).toBeLessThan(names(out).indexOf("Pikachu & Zekrom-GX"));
  });

  it("number match dominates name match", () => {
    const out = rankCards(provider, parseQuery("pikachu 33"));
    expect(out[0].id).toBe("sm9-33");
    expect(ids(out.slice(1, 4))).toEqual(["sv1-62", "swsh45sv-SV107", "base1-58"]);
  });

  it("matches prefixed and zero-padded numbers", () => {
    expect(rankCards(provider, parseQuery("pikachu sv107"))[0].id).toBe("swsh45sv-SV107");
    expect(rankCards(provider, parseQuery("pikachu 058"))[0].id).toBe("base1-58");
  });

  it("printed total breaks ties between same-number cards", () => {
    const cs = [card("a-25", "Pikachu", "25", "2020-01-01"), card("b-25", "Pikachu", "25", "2010-01-01")];
    const totals = new Map<string, number | undefined>([["a-25", 200], ["b-25", 102]]);
    expect(rankCards(cs, parseQuery("pikachu 25/102"), totals)[0].id).toBe("b-25");
  });

  it("missing dates sort last and ties keep provider order", () => {
    const cs = [card("x-1", "Pikachu", "1"), card("y-1", "Pikachu", "2", "2001-01-01"), card("z-1", "Pikachu", "3")];
    expect(ids(rankCards(cs, parseQuery("pikachu")))).toEqual(["y-1", "x-1", "z-1"]);
  });

  it("does not mutate its input", () => {
    const copy = [...provider];
    rankCards(provider, parseQuery("pikachu"));
    expect(provider).toEqual(copy);
  });
});

describe("searchCards re-ranks provider results (mocked fetch)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    __clearCardCaches();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('"pikachu" puts plain Pikachu ahead of Pikachu & Zekrom-GX and trims to limit', async () => {
    const data = [
      raw("sm9-33", "Pikachu & Zekrom-GX", "33", "2019/02/01"),
      raw("sm35-29", "Pikachu", "29", "2018/06/01"),
      raw("base1-58", "Pikachu", "58", "1999/01/09"),
    ];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data })));
    const out = await searchCards("pikachu", { limit: 2 });
    expect(ids(out)).toEqual(["sm35-29", "base1-58"]);
    const u = new URL(String(fetchMock.mock.calls[0][0]));
    expect(u.searchParams.get("pageSize")).toBe("100");
    expect(u.searchParams.get("orderBy")).toBe("-set.releaseDate");
  });

  it("set + number queries (no name) keep pageSize = limit", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [raw("sv3pt5-199", "Charizard ex", "199", "2023/09/22")] })));
    const out = await searchCards("sv3pt5 199", { limit: 5 });
    expect(out[0].id).toBe("sv3pt5-199");
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("pageSize")).toBe("5");
  });

  it("uses printedTotal from the raw set when ranking", async () => {
    const data = [raw("a-25", "Pikachu", "25", "2020/01/01", 200), raw("b-25", "Pikachu", "25", "2010/01/01", 102)];
    // first query (with total) finds nothing, fallback name-only query returns both
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data })));
    const out = await searchCards("pikachu 25/102");
    expect(out[0].id).toBe("b-25");
  });
});
