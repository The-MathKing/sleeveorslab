import type { GradeDistribution } from "@/lib/types";

/**
 * Static EXAMPLE used on marketing pages only. Not a real card, not market data.
 * The arithmetic below is real and must stay internally consistent:
 *   expected graded sale = Σ p(g) · value(g)               = 175.25
 *   net if graded        = 175.25 − 13% fees − 65 − 18      =  69.47
 *   net if sold raw      = 150 − 13% fees                   = 130.50
 *   expected gain        = 69.47 − 130.50                   = −61.03
 *   only a 10 clears 130.50 (0.87·V − 83 > 130.5 ⇒ V > 245) ⇒ P(loss) = 1 − 0.18 = 82%
 */
export const EXAMPLE = {
  cardName: "Example Holo ex",
  setLine: "Example Set · 199/197",
  grader: "PSA" as const,
  raw: 150,
  sellingFeeRate: 0.13,
  gradingFee: 65,
  shipping: 18,
  distribution: { 5: 0.005, 6: 0.015, 7: 0.06, 8: 0.22, 9: 0.52, 10: 0.18 } satisfies GradeDistribution,
  gradedValues: { 5: 70, 6: 80, 7: 95, 8: 120, 9: 165, 10: 310 } as Record<number, number>,
  expectedGraded: 175.25,
  sellingFeesGraded: 22.78,
  netIfGraded: 69.47,
  netRaw: 130.5,
  expectedGain: -61.03,
  probabilityOfLoss: 0.82,
  breakEvenGrade: 10 as const,
};
