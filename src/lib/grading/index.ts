// CONTRACT (owned by engines agent). Grader fees, tiers, centering tolerances, gem-rate priors.
import type { CenteringCap, CenteringResult, CardRef, Era, GraderId, GradingTier } from "@/lib/types";

export declare const FEES_LAST_VERIFIED: string; // ISO date the fee table was last checked
export declare function getTiers(grader?: GraderId): GradingTier[];
export declare function getTier(tierId: string): GradingTier | undefined;
export declare function defaultTierFor(grader: GraderId, declaredValueUsd: number): GradingTier;
export declare function centeringCaps(c: CenteringResult): CenteringCap[];
export declare function eraOf(card: Pick<CardRef, "releaseDate" | "setId">): Era;
/** Prior P(grade = 10) for a card with no defects visible, by era/finish/rarity. Documented assumptions. */
export declare function gemRatePrior(card: CardRef, grader: GraderId): { pGem: number; basis: string };
