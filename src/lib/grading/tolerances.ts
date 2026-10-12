// Centering tolerances as data. Ratios are the larger share (0.5..1): 0.55 = 55/45.
import type { CenteringCap, CenteringMeasurement, CenteringResult, Grade, GraderId } from "@/lib/types";
import { formatRatio } from "@/lib/centering/format";

/** Slack added to every limit to absorb photo/measurement error (1 percentage point). */
export const CENTERING_NOISE_MARGIN = 0.01;
/** CGC Pristine 10 needs ~50/50 on both sides; 0.52 already includes measurement noise. */
export const CGC_PRISTINE_MAX_RATIO = 0.52;

export interface ToleranceRow { grade: Grade; front: number; back: number }

export const PSA_TOLERANCES: readonly ToleranceRow[] = [
  { grade: 10, front: 0.55, back: 0.75 },
  { grade: 9, front: 0.6, back: 0.9 },
  { grade: 8, front: 0.65, back: 0.9 },
  { grade: 7, front: 0.7, back: 0.9 },
  { grade: 6, front: 0.8, back: 0.9 },
  { grade: 5, front: 0.85, back: 0.9 },
];

/** CGC 8.5 and 8 are both modelled as grade 8. Rows 7..5 assumed equal to PSA (estimate). */
export const CGC_TOLERANCES: readonly ToleranceRow[] = [
  { grade: 10, front: 0.55, back: 0.75 },
  { grade: 9, front: 0.6, back: 0.9 },
  { grade: 8, front: 0.65, back: 0.9 },
  { grade: 7, front: 0.7, back: 0.9 },
  { grade: 6, front: 0.8, back: 0.9 },
  { grade: 5, front: 0.85, back: 0.9 },
];

export const TOLERANCES: Record<GraderId, readonly ToleranceRow[]> = { PSA: PSA_TOLERANCES, CGC: CGC_TOLERANCES };

interface SideWorst { side: "front" | "back"; ratio: number; axis: "left-right" | "top-bottom" }

function worst(side: "front" | "back", m?: CenteringMeasurement): SideWorst | undefined {
  if (!m) return undefined;
  const lr = clampRatio(m.leftRight);
  const tb = clampRatio(m.topBottom);
  return lr >= tb ? { side, ratio: lr, axis: "left-right" } : { side, ratio: tb, axis: "top-bottom" };
}

function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 0.5;
  const v = Math.max(r, 1 - r);
  return Math.min(1, Math.max(0.5, v));
}

function failing(row: ToleranceRow, sides: SideWorst[]): SideWorst | undefined {
  // Return the side that violates this row by the largest amount.
  let bad: SideWorst | undefined;
  let excess = 0;
  for (const s of sides) {
    const lim = (s.side === "front" ? row.front : row.back) + CENTERING_NOISE_MARGIN;
    if (s.ratio > lim && s.ratio - lim > excess) { bad = s; excess = s.ratio - lim; }
  }
  return bad;
}

function capFor(grader: GraderId, c: CenteringResult): CenteringCap {
  const sides = [worst("front", c.front), worst("back", c.back)].filter((s): s is SideWorst => !!s);
  if (!sides.length) {
    return { grader, maxGrade: 10, label: `${grader} centering not measured — no cap applied`, ...(grader === "CGC" ? { pristineEligible: false } : {}) };
  }
  const rows = TOLERANCES[grader];
  let maxGrade: Grade = Math.max(1, rows[rows.length - 1].grade - 1) as Grade;
  let binding: SideWorst | undefined = failing(rows[rows.length - 1], sides);
  for (let i = 0; i < rows.length; i++) {
    if (!failing(rows[i], sides)) {
      maxGrade = rows[i].grade;
      binding = i > 0 ? failing(rows[i - 1], sides) : undefined;
      break;
    }
  }
  const cap: CenteringCap = { grader, maxGrade, label: "" };
  if (grader === "CGC") {
    cap.pristineEligible = maxGrade === 10 && sides.every((s) => s.ratio <= CGC_PRISTINE_MAX_RATIO);
  }
  if (maxGrade === 10) {
    cap.label = grader === "PSA" ? "PSA 10 eligible on centering"
      : cap.pristineEligible ? "CGC Pristine 10 eligible on centering" : "CGC 10 eligible on centering (not Pristine)";
  } else {
    const b = binding ?? sides[0];
    cap.label = `Caps at ${grader} ${maxGrade}: ${b.side} ${formatRatio(b.ratio)} ${b.axis}`;
  }
  return cap;
}

/** One cap per grader, using the worse of LR/TB on each measured side. */
export function centeringCaps(c: CenteringResult): CenteringCap[] {
  return [capFor("PSA", c ?? {}), capFor("CGC", c ?? {})];
}
