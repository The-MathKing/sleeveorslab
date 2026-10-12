// CONTRACT (owned by engines agent). Expected-value engine: pure, deterministic, unit-tested.
import type { EVInput, EVResult, GraderId, GradeDistribution, CardRef, CenteringResult } from "@/lib/types";

export declare function gradeDistribution(args: {
  card: CardRef; grader: GraderId; centering?: CenteringResult;
  gemRateOverride?: number; conditionSelfRating?: number;
}): GradeDistribution;
export declare function evaluate(input: EVInput): EVResult;
/** Run evaluate() for every grader/tier that applies and return the best plus all results. */
export declare function evaluateAllGraders(input: Omit<EVInput, "grader" | "tierId">): { best: EVResult; all: EVResult[] };
