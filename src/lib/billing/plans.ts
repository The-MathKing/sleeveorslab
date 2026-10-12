// Single source of truth for plans. Prices here are what the pricing page shows AND what
// /api/admin/billing/sync-products creates in Stripe. Change a price here, then re-run sync:
// Stripe prices are immutable, so sync creates a new Price and moves the lookup_key to it.

export type PlanId = "free" | "pro-monthly" | "pack-100";
export type PaidPlanId = Exclude<PlanId, "free">;

/** Pricing test arms. "monthly-first" is also the layout when the test is off. */
export const VARIANTS = ["monthly-first", "pack-first"] as const;
export type PricingVariant = (typeof VARIANTS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  /** Price in US cents. 0 for free. */
  priceCents: number;
  currency: "usd";
  /** Display string, e.g. "$6.99". */
  price: string;
  /** Display suffix, e.g. "/ month". */
  per: string;
  blurb: string;
  features: string[];
  /** "subscription" | "one-time" | null (free). */
  billing: "subscription" | "one-time" | null;
  /** Verdict / binder-scan credits granted per purchase. null = unlimited or not applicable. */
  credits: number | null;
  /** Stripe Price lookup_key; null for free. */
  lookupKey: string | null;
  /** Stripe Product name used by sync-products. */
  productName: string | null;
}

/** Mirrors FREE_VERDICTS_PER_DAY in src/lib/store (client-side soft limit). Kept here so server code never imports the IndexedDB store. */
export const FREE_VERDICTS_PER_DAY = 3;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    currency: "usd",
    price: "$0",
    per: "forever",
    blurb: "For the card you pulled last night.",
    features: [
      "Card lookup + raw prices",
      "Centering check, unlimited",
      `${FREE_VERDICTS_PER_DAY} full verdicts a day`,
      "Log verdicts to Receipts",
      "On-device collection",
    ],
    billing: null,
    credits: null,
    lookupKey: null,
    productName: null,
  },
  "pro-monthly": {
    id: "pro-monthly",
    name: "Pro",
    priceCents: 699,
    currency: "usd",
    price: "$6.99",
    per: "/ month",
    blurb: "For people who submit more than they'd like to admit.",
    features: [
      "Unlimited verdicts",
      "Binder triage for whole submissions",
      "Price alerts on saved cards (coming later)",
      "Everything in Free",
      "Cancel any time in the billing portal",
    ],
    billing: "subscription",
    credits: null,
    lookupKey: "sos_pro_monthly",
    productName: "Sleeve or Slab Pro",
  },
  "pack-100": {
    id: "pack-100",
    name: "Scan pack",
    priceCents: 1900,
    currency: "usd",
    price: "$19",
    per: "100 scans",
    blurb: "For one big submission, no subscription.",
    features: [
      "100 verdict or binder-scan credits",
      "Credits never expire",
      "Everything in Free",
      "One payment, nothing recurring",
    ],
    billing: "one-time",
    credits: 100,
    lookupKey: "sos_pack_100",
    productName: "Sleeve or Slab 100-scan pack",
  },
};

export const PAID_PLAN_IDS: PaidPlanId[] = ["pro-monthly", "pack-100"];

export function isPaidPlanId(v: unknown): v is PaidPlanId {
  return v === "pro-monthly" || v === "pack-100";
}

export function isVariant(v: unknown): v is PricingVariant {
  return v === "monthly-first" || v === "pack-first";
}

/** Paid plans in display order for a pricing-test arm. */
export type PaidPlan = Plan & { id: PaidPlanId };

export function orderedPaidPlans(variant: PricingVariant | null | undefined): PaidPlan[] {
  const ids: PaidPlanId[] = variant === "pack-first" ? ["pack-100", "pro-monthly"] : ["pro-monthly", "pack-100"];
  return ids.map((id) => PLANS[id] as PaidPlan);
}

/** Which paid plan gets the gold "featured" treatment for a pricing-test arm. */
export function featuredPlan(variant: PricingVariant | null | undefined): PaidPlanId {
  return variant === "pack-first" ? "pack-100" : "pro-monthly";
}

/** Public, serializable view of the plans (what /api/billing/config returns). */
export type PublicPlan = Pick<Plan, "id" | "name" | "priceCents" | "currency" | "price" | "per" | "blurb" | "features" | "billing" | "credits">;

export function publicPlans(): PublicPlan[] {
  return (Object.keys(PLANS) as PlanId[]).map((id) => {
    const { name, priceCents, currency, price, per, blurb, features, billing, credits } = PLANS[id];
    return { id, name, priceCents, currency, price, per, blurb, features, billing, credits };
  });
}
