import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { PAID_PLAN_IDS, PLANS, type PaidPlanId } from "@/lib/billing/plans";
import { APP_TAG } from "@/lib/billing/logic";
import { billingContext } from "@/lib/billing/server";
import { stripeClient } from "@/lib/billing/stripe";
import { requireAdmin } from "../../../_lib/admin";
import { jsonError } from "../../../_lib/http";
import { rateLimit } from "../../../_lib/rateLimit";
import { BILLING_LIMITS } from "../../../billing/_lib/limits";

export const dynamic = "force-dynamic";

function priceMatches(p: Stripe.Price, plan: (typeof PLANS)[PaidPlanId]): boolean {
  const recurringOk = plan.billing === "subscription" ? p.recurring?.interval === "month" && p.recurring.interval_count === 1 : !p.recurring;
  return p.active && p.unit_amount === plan.priceCents && p.currency === plan.currency && recurringOk;
}

/**
 * POST /api/admin/billing/sync-products: idempotently find-or-create the Products and Prices
 * from plans.ts by lookup_key, and store the resolved price ids. Safe to run repeatedly.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { store, config } = await billingContext().catch(() => ({ store: null, config: null }));
  if (!store || !config) return jsonError(500, "Billing store unavailable");
  if (!config.secretKey) return jsonError(409, "No Stripe secret key configured");
  const stripe = stripeClient(config.secretKey);

  const results: Array<{ plan: PaidPlanId; priceId: string; created: boolean }> = [];
  try {
    for (const id of PAID_PLAN_IDS) {
      const plan = PLANS[id];
      const lookupKey = plan.lookupKey!;
      const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];
      if (existing && priceMatches(existing, plan)) {
        results.push({ plan: id, priceId: existing.id, created: false });
        continue;
      }

      // Deterministic product id (same as the lookup key) makes product creation idempotent.
      const productId = lookupKey;
      let product: Stripe.Product;
      try {
        product = await stripe.products.retrieve(productId);
        if (!product.active) product = await stripe.products.update(productId, { active: true });
      } catch {
        product = await stripe.products.create({
          id: productId,
          name: plan.productName!,
          description: plan.blurb,
          metadata: { app: APP_TAG, plan: id },
        });
      }

      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: plan.priceCents,
          currency: plan.currency,
          lookup_key: lookupKey,
          transfer_lookup_key: true, // moves the key off an outdated price
          metadata: { app: APP_TAG, plan: id },
          ...(plan.billing === "subscription" ? { recurring: { interval: "month" as const, interval_count: 1 } } : {}),
        },
        { idempotencyKey: `sos-sync-${lookupKey}-${plan.priceCents}-${existing?.id ?? "none"}` },
      );
      if (existing && existing.id !== price.id && existing.active) {
        await stripe.prices.update(existing.id, { active: false }).catch(() => {});
      }
      results.push({ plan: id, priceId: price.id, created: true });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe request failed";
    return jsonError(502, `Stripe said: ${msg}`);
  }

  const priceIds = Object.fromEntries(results.map((r) => [r.plan, r.priceId])) as Record<PaidPlanId, string>;
  await store.updateSettings({ priceIds });
  return NextResponse.json({ ok: true, mode: config.mode, prices: results });
}
