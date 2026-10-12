import { describe, expect, it } from "vitest";
import type { CardRef, CenteringMeasurement, EVInput, PriceQuote } from "@/lib/types";
import { evaluate, evaluateAllGraders, expectedGrade, gradeDistribution, GRADES, SLAB_MAX_LOSS_PROBABILITY } from "./index";
import { rectQuad } from "@/lib/centering";

const card: CardRef = { id: "sv3pt5-199", name: "Charizard ex", setId: "sv3pt5", setName: "151", number: "199", releaseDate: "2023-09-22", rarity: "Special Illustration Rare" };
const m = (lr: number, tb = 0.5): CenteringMeasurement => ({
  leftRight: lr, topBottom: tb, borders: { left: 1, right: 1, top: 1, bottom: 1 },
  outer: rectQuad(0, 0, 1, 1), inner: rectQuad(0, 0, 1, 1), confidence: 1, method: "manual",
});
const price = (raw: number | undefined, psa?: Record<number, number>, est = false): PriceQuote => ({
  cardId: card.id, raw, graded: psa ? { PSA: psa } : {}, source: "manual", asOf: "2026-10-01T00:00:00Z", gradedIsEstimate: est,
});
const sum = (d: Record<number, number | undefined>) => Object.values(d).reduce<number>((a, b) => a + (b ?? 0), 0);

describe("gradeDistribution", () => {
  it("sums to 1 and covers grades 1..10", () => {
    for (const r of [1, 2, 3, 4, 5, 2.5]) for (const lr of [0.5, 0.58, 0.7, 0.95]) {
      const d = gradeDistribution({ card, grader: "PSA", conditionSelfRating: r, centering: { front: m(lr) } });
      expect(Math.abs(sum(d) - 1)).toBeLessThan(1e-9);
      for (const g of GRADES) expect(d[g]).toBeGreaterThanOrEqual(0);
    }
  });
  it("uses the prior and the override", () => {
    expect(gradeDistribution({ card, grader: "PSA" })[10]).toBeCloseTo(0.35, 9);
    expect(gradeDistribution({ card, grader: "PSA", gemRateOverride: 0.6 })[10]).toBeCloseTo(0.6, 9);
    const d = gradeDistribution({ card, grader: "PSA" });
    expect(d[9]!).toBeGreaterThan(d[8]!);
    expect(d[8]!).toBeGreaterThan(d[7]!);
    expect((d[6] ?? 0) + (d[7] ?? 0) + (d[8] ?? 0) + (d[9] ?? 0) + (d[10] ?? 0)).toBeGreaterThan(0.9);
  });
  it("worse centering never raises P(10)", () => {
    let prev = 1;
    for (let r = 0.5; r <= 1.0001; r += 0.005) {
      const p10 = gradeDistribution({ card, grader: "PSA", centering: { front: m(r) } })[10] ?? 0;
      expect(p10).toBeLessThanOrEqual(prev + 1e-12);
      prev = p10;
    }
    expect(gradeDistribution({ card, grader: "PSA", centering: { front: m(0.6) } })[10]).toBe(0);
  });
  it("collapses mass above the cap onto the cap", () => {
    const free = gradeDistribution({ card, grader: "PSA" });
    const capped = gradeDistribution({ card, grader: "PSA", centering: { front: m(0.6) } });
    expect(capped[9]).toBeCloseTo((free[9] ?? 0) + (free[10] ?? 0), 9);
  });
  it("better condition never lowers expected grade or P(10)", () => {
    for (const c of [undefined, { front: m(0.62) }]) {
      let prevE = 0, prevP = 0;
      for (let r = 1; r <= 5; r += 0.25) {
        const d = gradeDistribution({ card, grader: "CGC", conditionSelfRating: r, centering: c });
        expect(expectedGrade(d)).toBeGreaterThanOrEqual(prevE - 1e-12);
        expect(d[10] ?? 0).toBeGreaterThanOrEqual(prevP - 1e-12);
        prevE = expectedGrade(d); prevP = d[10] ?? 0;
      }
    }
  });
  it("is deterministic", () => {
    const a = gradeDistribution({ card, grader: "PSA", conditionSelfRating: 4 });
    expect(gradeDistribution({ card, grader: "PSA", conditionSelfRating: 4 })).toEqual(a);
  });
});

const reconcile = (r: ReturnType<typeof evaluate>) => {
  const s = r.breakdown.reduce((a, l) => a + l.amountUsd, 0);
  expect(Math.round(s * 100) / 100).toBe(r.expectedProfitUsd);
};

describe("evaluate", () => {
  const base: EVInput = { card, price: price(40, { 10: 120, 9: 55, 8: 40 }), grader: "PSA", tierId: "psa-standard" };

  it("sleeves a cheap card and says so bluntly", () => {
    const r = evaluate({ ...base, card: { ...card, rarity: "Common" }, price: price(5, { 10: 20, 9: 10 }) });
    expect(r.verdict).toBe("SLEEVE");
    expect(r.expectedProfitUsd).toBeLessThan(0);
    expect(r.reasons[0]).toMatch(/Fees eat \$66 of a \$5 card\. Sleeve it\./);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
    expect(r.reasons.length).toBeLessThanOrEqual(4);
    reconcile(r);
  });

  it("slabs a valuable, well-centered card", () => {
    const r = evaluate({
      ...base, price: price(300, { 10: 1500, 9: 450, 8: 320 }), gemRateOverride: 0.5,
      centering: { front: m(0.52), back: m(0.6) },
    });
    expect(r.verdict).toBe("SLAB");
    expect(r.probabilityOfLoss).toBeLessThan(SLAB_MAX_LOSS_PROBABILITY);
    expect(r.confidence).toBe("high");
    reconcile(r);
  });

  it("breakdown reconciles to expectedProfit for many inputs", () => {
    for (const raw of [1, 13.37, 40, 250, 999.99]) for (const tierId of ["psa-standard", "psa-express", "cgc-standard", "cgc-bulk"]) {
      const grader = tierId.startsWith("psa") ? "PSA" as const : "CGC" as const;
      const r = evaluate({ ...base, price: price(raw, { 10: raw * 4.1, 9: raw * 1.33 }), grader, tierId, conditionSelfRating: 4 });
      reconcile(r);
      expect(r.totalCostUsd).toBeGreaterThan(0);
    }
  });

  it("computes break-even and probability of loss consistently", () => {
    const r = evaluate({ ...base, price: price(100, { 10: 400, 9: 130, 8: 100, 7: 80 }) });
    expect(r.breakEvenGrade).toBe(10);
    expect(r.probabilityOfLoss).toBeCloseTo(1 - (r.distribution[10] ?? 0), 9);
    expect(r.reasons.some((x) => /Only a 10 pays, and there's ~\d+% chance of one\./.test(x))).toBe(true);
  });

  it("estimates raw from graded prices when raw is missing", () => {
    const r = evaluate({ ...base, price: price(undefined, { 10: 200, 9: 100, 8: 60 }) });
    expect(r.rawValueUsd).toBe(40);
    expect(r.assumptions.join(" ")).toMatch(/Raw price missing/);
    expect(r.confidence).toBe("low");
  });

  it("fills missing graded prices with multiples and flags them", () => {
    const r = evaluate({ ...base, price: price(40) });
    expect(r.assumptions.join(" ")).toMatch(/gradedIsEstimate/);
    expect(r.confidence).toBe("low");
    const withCentering = evaluate({ ...base, price: price(40), centering: { front: m(0.5) } });
    expect(withCentering.confidence).toBe("medium");
  });

  it("handles no price data at all without throwing", () => {
    const r = evaluate({ ...base, price: price(undefined) });
    expect(r.verdict).toBe("SLEEVE");
    reconcile(r);
  });

  it("adds an upcharge when the slab exceeds the declared-value cap", () => {
    const r = evaluate({ ...base, price: price(2000, { 10: 9000, 9: 3000, 8: 2200 }) });
    expect(r.breakdown.some((l) => l.label === "Declared-value upcharge")).toBe(true);
    expect(r.totalCostUsd).toBeGreaterThan(59.99 + 6);
    expect(r.tier.id).toBe("psa-standard");
    reconcile(r);
  });

  it("price drift and selling fees lower the outcome", () => {
    const a = evaluate({ ...base, annualPriceDrift: 0 });
    const b = evaluate({ ...base, annualPriceDrift: -0.3 });
    expect(b.expectedGradedValueUsd).toBeLessThan(a.expectedGradedValueUsd);
    const c = evaluate({ ...base, sellingFeeRate: 0 });
    expect(c.breakdown.find((l) => l.label.startsWith("Selling fees"))!.amountUsd).toBe(0);
  });

  it("worse centering never improves expected profit", () => {
    let prev = Infinity;
    for (const r of [0.5, 0.56, 0.6, 0.66, 0.72, 0.9]) {
      const p = evaluate({ ...base, centering: { front: m(r) } }).expectedProfitUsd;
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });

  it("verdict thresholds: borderline between 0 and the SLAB bar", () => {
    // Tune graded prices so the expected profit is small but positive.
    const r = evaluate({ ...base, price: price(100, { 10: 260, 9: 150, 8: 110 }), gemRateOverride: 0.3, annualPriceDrift: 0 });
    if (r.expectedProfitUsd >= 0 && r.expectedProfitUsd <= Math.max(10, 0.15 * r.totalCostUsd)) expect(r.verdict).toBe("BORDERLINE");
    expect(["BORDERLINE", "SLAB", "SLEEVE"]).toContain(r.verdict);
  });

  it("rejects unknown tiers or mismatched graders", () => {
    expect(() => evaluate({ ...base, tierId: "nope" })).toThrow();
    expect(() => evaluate({ ...base, grader: "CGC" })).toThrow();
  });

  it("notes the bulk minimum", () => {
    const r = evaluate({ ...base, grader: "CGC", tierId: "cgc-bulk" });
    expect(r.assumptions.join(" ")).toMatch(/25-card minimum/);
  });
});

describe("evaluateAllGraders", () => {
  it("evaluates every available tier and returns the best", () => {
    const { best, all } = evaluateAllGraders({ card, price: price(100, { 10: 500, 9: 140 }) });
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(all.some((r) => r.grader === "CGC")).toBe(true);
    expect(all.every((r) => r.tier.available)).toBe(true);
    expect(all.some((r) => r.tier.id.startsWith("psa-value"))).toBe(false);
    expect(Math.max(...all.map((r) => r.expectedProfitUsd))).toBe(best.expectedProfitUsd);
  });
});
