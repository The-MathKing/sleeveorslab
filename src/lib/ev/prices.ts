import type { Era, Grade, GraderId, PriceQuote } from "@/lib/types";
import { GRADES } from "./distribution";

/**
 * Graded value as a multiple of raw, used only when market data is missing.
 * Estimates: PSA 10 ≈ 3.5–5x raw (higher for older eras), 9 ≈ 1.3x, 8 ≈ 1.0x, ≤7 below raw.
 */
export const PSA10_RAW_MULTIPLIER: Record<Era, number> = {
  modern: 3.5, "sword-shield": 4, "sun-moon": 4.5, xy: 5, older: 5,
};
export const PSA_RAW_MULTIPLIER_BELOW_10: Record<Exclude<Grade, 10>, number> = {
  9: 1.3, 8: 1.0, 7: 0.8, 6: 0.7, 5: 0.6, 4: 0.5, 3: 0.5, 2: 0.5, 1: 0.5,
};
/** CGC slabs typically sell below PSA at the same number (estimate). */
export const CGC_VS_PSA = { ten: 0.6, other: 0.85 } as const;
/** Raw value fallback = median known graded price x this factor. */
export const RAW_FROM_GRADED_FACTOR = 0.4;

export type PriceSource = "market" | "interpolated" | "from-psa" | "multiplier";

export interface PriceLadder {
  value: Record<Grade, number>;
  source: Record<Grade, PriceSource>;
}

function known(price: PriceQuote, grader: GraderId): Partial<Record<Grade, number>> {
  const out: Partial<Record<Grade, number>> = {};
  const g = price.graded?.[grader] ?? {};
  for (const k of GRADES) {
    const v = g[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

export function resolveRaw(price: PriceQuote): { raw: number; estimated: boolean; missing: boolean } {
  if (typeof price.raw === "number" && Number.isFinite(price.raw) && price.raw > 0) {
    return { raw: price.raw, estimated: false, missing: false };
  }
  const all: number[] = [];
  for (const gr of ["PSA", "CGC"] as GraderId[]) all.push(...Object.values(known(price, gr)) as number[]);
  if (!all.length) return { raw: 0, estimated: true, missing: true };
  all.sort((a, b) => a - b);
  const m = all.length >> 1;
  const med = all.length % 2 ? all[m] : (all[m - 1] + all[m]) / 2;
  return { raw: med * RAW_FROM_GRADED_FACTOR, estimated: true, missing: false };
}

function multiplier(grader: GraderId, g: Grade, era: Era): number {
  const psa = g === 10 ? PSA10_RAW_MULTIPLIER[era] : PSA_RAW_MULTIPLIER_BELOW_10[g as Exclude<Grade, 10>];
  if (grader === "PSA") return psa;
  return psa * (g === 10 ? CGC_VS_PSA.ten : CGC_VS_PSA.other);
}

/** Price for every grade: market data, else interpolation, else PSA-derived (CGC), else raw multiple. */
export function buildPriceLadder(price: PriceQuote, grader: GraderId, raw: number, era: Era): PriceLadder {
  const k = known(price, grader);
  const psa = known(price, "PSA");
  const value = {} as Record<Grade, number>;
  const source = {} as Record<Grade, PriceSource>;
  const ks = (Object.keys(k).map(Number) as Grade[]).sort((a, b) => a - b);
  for (const g of GRADES) {
    if (k[g] !== undefined) { value[g] = k[g]!; source[g] = "market"; continue; }
    const lo = [...ks].reverse().find((x) => x < g);
    const hi = ks.find((x) => x > g);
    if (lo !== undefined && hi !== undefined) {
      const t = (g - lo) / (hi - lo);
      value[g] = k[lo]! + t * (k[hi]! - k[lo]!);
      source[g] = "interpolated";
    } else if (grader === "CGC" && psa[g] !== undefined) {
      value[g] = psa[g]! * (g === 10 ? CGC_VS_PSA.ten : CGC_VS_PSA.other);
      source[g] = "from-psa";
    } else {
      value[g] = raw * multiplier(grader, g, era);
      source[g] = "multiplier";
    }
  }
  return { value, source };
}
