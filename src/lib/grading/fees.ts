// ============================================================================
// THE ONE PLACE GRADING FEES LIVE.
// Every fee, turnaround and declared-value cap shown anywhere in the app must
// come from this table. Update FEES_LAST_VERIFIED whenever you re-check it.
// Each tier's `notes` names its source and check date. Numbers marked
// "Verify on grader site" could not be confirmed on the grader's own page.
// ============================================================================
import type { GraderId, GradingTier } from "@/lib/types";

export const FEES_LAST_VERIFIED = "2026-10-12";

const VERIFY = "Verify on grader site";
const PSA_SRC = "psacard.com/services/tradingcardgrading, checked 2026-10-12";
const CGC_SRC = "cgccards.com/submit/services-fees/, checked 2026-10-12";
const CGC_MEMBER = "Price for Collector-level members; Associate/Premium members save 10%, Elite 20%";

export const GRADING_TIERS: readonly GradingTier[] = [
  // ---- PSA ----------------------------------------------------------------
  // PSA's page shows "Value Services Are Temporarily Paused" and lists Value Bulk
  // and Value as "Currently Unavailable" (max insured value $500 each), with no
  // price or turnaround. Fees/turnarounds/minimums below are the last published
  // values from secondary sources and are NOT verified on psacard.com.
  {
    grader: "PSA", id: "psa-value-bulk", name: "PSA Value Bulk", feeUsd: 24.99,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [95, 120], minCards: 20,
    available: false,
    notes: `Paused ("Currently Unavailable") and $500 cap per ${PSA_SRC}. Unverified: fee, turnaround, 20-card minimum and Collectors Club membership requirement not shown on official page. ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-value", name: "PSA Value", feeUsd: 32.99,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [65, 90],
    available: false,
    notes: `Paused ("Currently Unavailable") and $500 cap per ${PSA_SRC}. Unverified: fee and turnaround not shown on official page. ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-value-plus", name: "PSA Value Plus", feeUsd: 49.99,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [40, 60],
    available: false,
    notes: `Paused: not listed at all on ${PSA_SRC} (page says Value services are paused). Unverified: fee, cap and turnaround. ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-standard", name: "PSA Standard", feeUsd: 59.99,
    maxDeclaredValueUsd: 1000, turnaroundBusinessDays: [90, 100],
    available: true, notes: PSA_SRC,
  },
  {
    // PSA now calls this level "Priority"; id kept for existing references.
    grader: "PSA", id: "psa-regular", name: "PSA Priority", feeUsd: 79.99,
    maxDeclaredValueUsd: 1500, turnaroundBusinessDays: [70, 80],
    available: true, notes: `${PSA_SRC} (listed as "Priority", formerly Regular)`,
  },
  {
    grader: "PSA", id: "psa-express", name: "PSA Express", feeUsd: 199,
    maxDeclaredValueUsd: 2500, turnaroundBusinessDays: [20, 30],
    available: true, notes: PSA_SRC,
  },
  {
    grader: "PSA", id: "psa-super-express", name: "PSA Super Express", feeUsd: 349,
    maxDeclaredValueUsd: 5000, turnaroundBusinessDays: [10, 15],
    available: true, notes: PSA_SRC,
  },
  {
    grader: "PSA", id: "psa-premier", name: "PSA Premier", feeUsd: 599,
    maxDeclaredValueUsd: 10000, turnaroundBusinessDays: [7, 10],
    available: true, notes: PSA_SRC,
  },
  {
    grader: "PSA", id: "psa-premium-1", name: "PSA Premium 1", feeUsd: 999,
    maxDeclaredValueUsd: 25000, turnaroundBusinessDays: [5, 7],
    available: true, notes: PSA_SRC,
  },
  {
    grader: "PSA", id: "psa-premium-2", name: "PSA Premium 2", feeUsd: 1999,
    maxDeclaredValueUsd: 50000, turnaroundBusinessDays: [5, 7],
    available: true, notes: PSA_SRC,
  },
  {
    grader: "PSA", id: "psa-premium-3", name: "PSA Premium 3", feeUsd: 2999,
    maxDeclaredValueUsd: 100000, turnaroundBusinessDays: [5, 7],
    available: true, notes: PSA_SRC,
  },
  {
    grader: "PSA", id: "psa-premium-5", name: "PSA Premium 5", feeUsd: 4999,
    maxDeclaredValueUsd: 250000, turnaroundBusinessDays: [5, 7],
    available: true,
    notes: `${PSA_SRC}. Premium 10 (from $9,999, value-scaled above $350k) omitted: fee is not a flat per-card price`,
  },
  // ---- CGC ----------------------------------------------------------------
  // CGC publishes a single estimated turnaround in working days per tier.
  {
    grader: "CGC", id: "cgc-bulk", name: "CGC Bulk", feeUsd: 17,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [150, 150], minCards: 25,
    available: true, notes: `${CGC_SRC}. ${CGC_MEMBER}`,
  },
  {
    grader: "CGC", id: "cgc-economy", name: "CGC Economy", feeUsd: 20,
    maxDeclaredValueUsd: 1000, turnaroundBusinessDays: [90, 90],
    available: true, notes: `${CGC_SRC}. ${CGC_MEMBER}`,
  },
  {
    grader: "CGC", id: "cgc-standard", name: "CGC Standard", feeUsd: 55,
    maxDeclaredValueUsd: 3000, turnaroundBusinessDays: [10, 10],
    available: true, notes: `${CGC_SRC}. ${CGC_MEMBER}`,
  },
  {
    grader: "CGC", id: "cgc-express", name: "CGC Express", feeUsd: 100,
    maxDeclaredValueUsd: 10000, turnaroundBusinessDays: [5, 5],
    available: true, notes: `${CGC_SRC}. ${CGC_MEMBER}`,
  },
  {
    grader: "CGC", id: "cgc-walkthrough", name: "CGC WalkThrough", feeUsd: 300,
    maxDeclaredValueUsd: 100000, turnaroundBusinessDays: [2, 2],
    available: true,
    notes: `${CGC_SRC}. ${CGC_MEMBER}. Unlimited Value ($300 + 1% of FMV, 2 days) omitted: fee is not a flat per-card price`,
  },
];

export function getTiers(grader?: GraderId): GradingTier[] {
  return GRADING_TIERS.filter((t) => !grader || t.grader === grader).map((t) => ({ ...t }));
}

export function getTier(tierId: string): GradingTier | undefined {
  const t = GRADING_TIERS.find((x) => x.id === tierId);
  return t ? { ...t } : undefined;
}

/** True when a tier can be used for a single card (no batch minimum). */
export function isSingleCardTier(t: GradingTier): boolean {
  return (t.minCards ?? 1) <= 1;
}

/**
 * Cheapest available single-card tier whose declared-value cap covers the value.
 * Falls back to the available single-card tier with the highest cap.
 */
export function defaultTierFor(grader: GraderId, declaredValueUsd: number): GradingTier {
  const candidates = GRADING_TIERS.filter((t) => t.grader === grader && t.available && isSingleCardTier(t));
  const eligible = candidates
    .filter((t) => t.maxDeclaredValueUsd === undefined || t.maxDeclaredValueUsd >= declaredValueUsd)
    .sort((a, b) => a.feeUsd - b.feeUsd);
  if (eligible.length) return { ...eligible[0] };
  const byCap = [...candidates].sort((a, b) => (b.maxDeclaredValueUsd ?? Infinity) - (a.maxDeclaredValueUsd ?? Infinity));
  if (byCap.length) return { ...byCap[0] };
  // Should never happen with the table above; return any tier of that grader.
  return { ...GRADING_TIERS.find((t) => t.grader === grader)! };
}
