import type { CardRef, CenteringResult, Grade, GradeDistribution, GraderId } from "@/lib/types";
import { centeringCaps, gemRatePrior } from "@/lib/grading";

export const GRADES: readonly Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Shape of the non-10 mass (relative weights, normalised). Most of the remainder
 * lands on 9, then decays quickly. Estimate, not pop-report data.
 */
export const NON_GEM_SHAPE: Readonly<Record<Exclude<Grade, 10>, number>> = {
  9: 0.5, 8: 0.25, 7: 0.12, 6: 0.06, 5: 0.03, 4: 0.02, 3: 0.01, 2: 0.005, 1: 0.005,
};

/** Grades of shift per condition step away from neutral (3). Rating 5 => +0.7 grades. */
export const CONDITION_SHIFT_PER_STEP = 0.35;
export const MIN_P_GEM = 0.001;
export const MAX_P_GEM = 0.98;

export interface DistributionArgs {
  card: CardRef; grader: GraderId; centering?: CenteringResult;
  gemRateOverride?: number; conditionSelfRating?: number;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

/** Shift mass by a (fractional) number of grades, piling overflow on 10 / 1. */
function shift(p: number[], s: number): number[] {
  if (s === 0) return p;
  const out = new Array<number>(11).fill(0);
  const whole = Math.floor(s), frac = s - whole;
  for (let g = 1; g <= 10; g++) {
    const m = p[g];
    if (!m) continue;
    const a = clamp(g + whole, 1, 10), b = clamp(g + whole + 1, 1, 10);
    out[a] += m * (1 - frac);
    out[b] += m * frac;
  }
  return out;
}

export function gemProbability(args: DistributionArgs): { pGem: number; basis: string } {
  if (typeof args.gemRateOverride === "number" && Number.isFinite(args.gemRateOverride)) {
    const pGem = clamp(args.gemRateOverride, MIN_P_GEM, MAX_P_GEM);
    return { pGem, basis: `Gem rate set by you: ${Math.round(pGem * 100)}% ${args.grader} 10` };
  }
  const prior = gemRatePrior(args.card, args.grader);
  return { pGem: clamp(prior.pGem, MIN_P_GEM, MAX_P_GEM), basis: prior.basis };
}

export function gradeDistribution(args: DistributionArgs): GradeDistribution {
  const { pGem } = gemProbability(args);
  const p = new Array<number>(11).fill(0);
  p[10] = pGem;
  const shapeSum = Object.values(NON_GEM_SHAPE).reduce((a, b) => a + b, 0);
  for (let g = 1; g <= 9; g++) p[g] = ((1 - pGem) * NON_GEM_SHAPE[g as Exclude<Grade, 10>]) / shapeSum;

  const rating = typeof args.conditionSelfRating === "number" && Number.isFinite(args.conditionSelfRating)
    ? clamp(args.conditionSelfRating, 1, 5) : 3;
  let q = shift(p, (rating - 3) * CONDITION_SHIFT_PER_STEP);

  if (args.centering) {
    const cap = centeringCaps(args.centering).find((c) => c.grader === args.grader)?.maxGrade ?? 10;
    for (let g = cap + 1; g <= 10; g++) { q[cap] += q[g]; q[g] = 0; }
  }

  const total = q.reduce((a, b) => a + b, 0);
  q = q.map((v) => v / total);
  // Push any floating-point residue onto the largest bucket so the sum is exactly 1.
  let maxG = 1;
  for (let g = 1; g <= 10; g++) if (q[g] > q[maxG]) maxG = g;
  const resid = 1 - q.slice(1).reduce((a, b) => a + b, 0);
  q[maxG] += resid;

  const out: GradeDistribution = {};
  for (const g of GRADES) out[g] = q[g];
  return out;
}

export function expectedGrade(d: GradeDistribution): number {
  return GRADES.reduce((s, g) => s + g * (d[g] ?? 0), 0);
}
