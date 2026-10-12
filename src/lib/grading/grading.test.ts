import { describe, expect, it } from "vitest";
import type { CardRef, CenteringMeasurement, CenteringResult } from "@/lib/types";
import {
  CENTERING_NOISE_MARGIN, FEES_LAST_VERIFIED, centeringCaps, defaultTierFor, eraOf, gemRatePrior, getTier, getTiers,
} from "./index";
import { rectQuad } from "@/lib/centering";

const m = (lr: number, tb: number): CenteringMeasurement => ({
  leftRight: lr, topBottom: tb, borders: { left: 1, right: 1, top: 1, bottom: 1 },
  outer: rectQuad(0, 0, 1, 1), inner: rectQuad(0, 0, 1, 1), confidence: 1, method: "manual",
});
const card = (o: Partial<CardRef> = {}): CardRef => ({ id: "x", name: "Test", setId: "sv1", setName: "S", number: "1", ...o });

describe("fees", () => {
  it("has the plan's known facts", () => {
    expect(FEES_LAST_VERIFIED).toBe("2026-10-12");
    expect(getTier("psa-standard")?.feeUsd).toBe(59.99);
    expect(getTier("psa-standard")?.turnaroundBusinessDays).toEqual([90, 100]);
    expect(getTier("psa-regular")?.feeUsd).toBe(79.99);
    expect(getTier("cgc-bulk")).toMatchObject({ feeUsd: 17, minCards: 25 });
    expect(getTiers("PSA").filter((t) => t.id.startsWith("psa-value")).every((t) => !t.available)).toBe(true);
  });
  it("every tier is well-formed and unverified numbers are flagged", () => {
    const ids = new Set<string>();
    for (const t of getTiers()) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(t.feeUsd).toBeGreaterThan(0);
      expect(t.turnaroundBusinessDays[0]).toBeLessThanOrEqual(t.turnaroundBusinessDays[1]);
      expect(t.notes ?? "").toMatch(/Verify on grader site|paused/i);
    }
  });
  it("getTiers filters by grader and returns copies", () => {
    expect(getTiers("CGC").every((t) => t.grader === "CGC")).toBe(true);
    getTiers()[0].feeUsd = 0;
    expect(getTiers()[0].feeUsd).toBeGreaterThan(0);
    expect(getTier("nope")).toBeUndefined();
  });
  it("defaultTierFor picks cheapest available single-card tier covering the value", () => {
    expect(defaultTierFor("PSA", 100).id).toBe("psa-standard");
    expect(defaultTierFor("PSA", 1200).id).toBe("psa-regular");
    expect(defaultTierFor("PSA", 4000).id).toBe("psa-super-express");
    expect(defaultTierFor("PSA", 1e6).id).toBe("psa-super-express");
    expect(defaultTierFor("CGC", 100).id).toBe("cgc-standard");
  });
});

describe("eraOf", () => {
  it("maps release dates", () => {
    expect(eraOf({ setId: "", releaseDate: "2023-03-31" })).toBe("modern");
    expect(eraOf({ setId: "", releaseDate: "2023/03/31" })).toBe("modern");
    expect(eraOf({ setId: "", releaseDate: "2022-11-11" })).toBe("sword-shield");
    expect(eraOf({ setId: "", releaseDate: "2018-05-04" })).toBe("sun-moon");
    expect(eraOf({ setId: "", releaseDate: "2015-02-04" })).toBe("xy");
    expect(eraOf({ setId: "", releaseDate: "1999-01-09" })).toBe("older");
  });
  it("falls back to set id", () => {
    expect(eraOf({ setId: "sv3pt5" })).toBe("modern");
    expect(eraOf({ setId: "swsh12" })).toBe("sword-shield");
    expect(eraOf({ setId: "sm115" })).toBe("sun-moon");
    expect(eraOf({ setId: "xy1" })).toBe("xy");
    expect(eraOf({ setId: "base1" })).toBe("older");
  });
});

describe("gemRatePrior", () => {
  it("is labelled as an estimate and matches the documented example", () => {
    const r = gemRatePrior(card({ releaseDate: "2023-09-01", finish: "full-art" }), "PSA");
    expect(r.pGem).toBe(0.35);
    expect(r.basis).toMatch(/estimate/);
    expect(r.basis).toMatch(/35% PSA 10/);
  });
  it("CGC 10 is harder than PSA 10", () => {
    for (const c of [card({ finish: "holo" }), card({ rarity: "Common" }), card({ releaseDate: "1999-01-09" })]) {
      expect(gemRatePrior(c, "CGC").pGem).toBeLessThan(gemRatePrior(c, "PSA").pGem);
    }
  });
  it("full-art gems lower than non-holo; older eras gem lower", () => {
    const fa = gemRatePrior(card({ rarity: "Special Illustration Rare" }), "PSA").pGem;
    const nh = gemRatePrior(card({ rarity: "Common" }), "PSA").pGem;
    expect(fa).toBeLessThan(nh);
    const eras = ["2024-01-01", "2021-01-01", "2018-01-01", "2015-01-01", "2000-01-01"]
      .map((d) => gemRatePrior(card({ releaseDate: d, finish: "holo" }), "PSA").pGem);
    for (let i = 1; i < eras.length; i++) expect(eras[i]).toBeLessThan(eras[i - 1]);
  });
});

describe("centeringCaps", () => {
  const cap = (c: CenteringResult, g: "PSA" | "CGC") => centeringCaps(c).find((x) => x.grader === g)!;
  it("returns one cap per grader", () => {
    expect(centeringCaps({}).map((c) => c.grader).sort()).toEqual(["CGC", "PSA"]);
    expect(cap({}, "PSA").maxGrade).toBe(10);
  });
  it("PSA 10 eligible at 55/45 (within noise), caps at 9 beyond", () => {
    expect(cap({ front: m(0.55, 0.5) }, "PSA")).toMatchObject({ maxGrade: 10, label: "PSA 10 eligible on centering" });
    expect(cap({ front: m(0.55 + CENTERING_NOISE_MARGIN - 0.001, 0.5) }, "PSA").maxGrade).toBe(10);
    const c = cap({ front: m(0.58, 0.52) }, "PSA");
    expect(c.maxGrade).toBe(9);
    expect(c.label).toBe("Caps at PSA 9: front 58/42 left-right");
  });
  it("uses the worse axis and the back tolerances", () => {
    expect(cap({ front: m(0.5, 0.67) }, "PSA").label).toBe("Caps at PSA 7: front 67/33 top-bottom");
    expect(cap({ front: m(0.5, 0.5), back: m(0.8, 0.5) }, "PSA")).toMatchObject({ maxGrade: 9 });
    expect(cap({ front: m(0.5, 0.5), back: m(0.8, 0.5) }, "PSA").label).toMatch(/back 80\/20 left-right/);
    expect(cap({ front: m(0.5, 0.5), back: m(0.95, 0.5) }, "PSA").maxGrade).toBe(4);
  });
  it("walks the PSA ladder", () => {
    const expected: Array<[number, number]> = [[0.5, 10], [0.6, 9], [0.65, 8], [0.7, 7], [0.78, 6], [0.85, 5], [0.9, 4]];
    for (const [r, g] of expected) expect(cap({ front: m(r, 0.5) }, "PSA").maxGrade).toBe(g);
  });
  it("CGC pristine only near 50/50", () => {
    expect(cap({ front: m(0.51, 0.52), back: m(0.5, 0.51) }, "CGC")).toMatchObject({ maxGrade: 10, pristineEligible: true });
    expect(cap({ front: m(0.54, 0.5) }, "CGC")).toMatchObject({ maxGrade: 10, pristineEligible: false });
    expect(cap({ front: m(0.62, 0.5) }, "CGC").maxGrade).toBe(8);
  });
  it("worse centering never raises the cap", () => {
    let prev = 10;
    for (let r = 0.5; r <= 1; r += 0.01) {
      const g = cap({ front: m(r, 0.5) }, "PSA").maxGrade;
      expect(g).toBeLessThanOrEqual(prev);
      prev = g;
    }
  });
});
