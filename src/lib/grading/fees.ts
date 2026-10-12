// ============================================================================
// THE ONE PLACE GRADING FEES LIVE.
// Every fee, turnaround and declared-value cap shown anywhere in the app must
// come from this table. Update FEES_LAST_VERIFIED whenever you re-check it.
// Numbers marked `notes: "Verify on grader site"` are best-known values that
// were NOT in the business plan and must be confirmed before launch.
// ============================================================================
import type { GraderId, GradingTier } from "@/lib/types";

export const FEES_LAST_VERIFIED = "2026-10-12";

const VERIFY = "Verify on grader site";

export const GRADING_TIERS: readonly GradingTier[] = [
  // ---- PSA ----------------------------------------------------------------
  {
    grader: "PSA", id: "psa-value-bulk", name: "PSA Value Bulk", feeUsd: 24.99,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [95, 120], minCards: 20,
    available: false, notes: `Currently paused by PSA. Fee/cap: ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-value", name: "PSA Value", feeUsd: 32.99,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [65, 90],
    available: false, notes: `Currently paused by PSA. Fee/cap: ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-value-plus", name: "PSA Value Plus", feeUsd: 49.99,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [40, 60],
    available: false, notes: `Currently paused by PSA. Fee/cap: ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-standard", name: "PSA Standard", feeUsd: 59.99,
    maxDeclaredValueUsd: 1000, turnaroundBusinessDays: [90, 100],
    available: true, notes: `Fee and turnaround per business plan; declared-value cap: ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-regular", name: "PSA Regular", feeUsd: 79.99,
    maxDeclaredValueUsd: 1500, turnaroundBusinessDays: [30, 45],
    available: true, notes: `Fee per business plan; turnaround and cap: ${VERIFY}`,
  },
  {
    grader: "PSA", id: "psa-express", name: "PSA Express", feeUsd: 149,
    maxDeclaredValueUsd: 2500, turnaroundBusinessDays: [10, 15],
    available: true, notes: VERIFY,
  },
  {
    grader: "PSA", id: "psa-super-express", name: "PSA Super Express", feeUsd: 299,
    maxDeclaredValueUsd: 5000, turnaroundBusinessDays: [5, 7],
    available: true, notes: VERIFY,
  },
  // ---- CGC ----------------------------------------------------------------
  {
    grader: "CGC", id: "cgc-bulk", name: "CGC Bulk", feeUsd: 17,
    maxDeclaredValueUsd: 500, turnaroundBusinessDays: [40, 60], minCards: 25,
    available: true, notes: `$17/card with 25-card minimum per business plan; cap and turnaround: ${VERIFY}`,
  },
  {
    grader: "CGC", id: "cgc-standard", name: "CGC Standard", feeUsd: 30,
    maxDeclaredValueUsd: 1000, turnaroundBusinessDays: [20, 30],
    available: true, notes: VERIFY,
  },
  {
    grader: "CGC", id: "cgc-express", name: "CGC Express", feeUsd: 65,
    maxDeclaredValueUsd: 3000, turnaroundBusinessDays: [5, 10],
    available: true, notes: VERIFY,
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
