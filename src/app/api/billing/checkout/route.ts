import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCheckoutParams } from "@/lib/billing/logic";
import { VARIANTS } from "@/lib/billing/plans";
import { bearerCustomerId, billingContext, siteOrigin } from "@/lib/billing/server";
import { isActiveSubStatus } from "@/lib/billing/store";
import { stripeClient } from "@/lib/billing/stripe";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  plan: z.enum(["pro-monthly", "pack-100"]),
  variant: z.enum(VARIANTS).nullish(),
});

/** POST /api/billing/checkout {plan, variant?} → {url} (Stripe Checkout), or 409 while payments are off. */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.checkout);
  if (limited) return limited;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  const { plan } = parsed.data;

  try {
    const { store, config } = await billingContext();
    if (!config.enabled || !config.secretKey) return jsonError(409, "Payments aren't switched on yet. Join the waitlist and we'll email you.");
    const priceId = config.priceIds[plan];
    if (!priceId) return jsonError(409, "This plan isn't available yet");

    // A valid entitlement token lets a returning buyer stack purchases on one Stripe customer.
    let customerId: string | null = null;
    const cid = bearerCustomerId(req);
    if (cid) {
      const c = await store.getCustomer(cid);
      if (c && c.livemode === (config.mode === "live")) {
        if (plan === "pro-monthly" && isActiveSubStatus(c.subscriptionStatus)) {
          return jsonError(409, "You already have Pro. Manage it from the billing portal.");
        }
        customerId = c.id;
      }
    }

    const session = await stripeClient(config.secretKey).checkout.sessions.create(
      buildCheckoutParams({
        plan,
        variant: config.splitTest ? (parsed.data.variant ?? null) : null,
        priceId,
        origin: siteOrigin(req),
        clientReferenceId: `sos_${randomUUID()}`,
        customerId,
      }),
    );
    if (!session.url) return jsonError(502, "Stripe didn't return a checkout link");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return serverError(err, "Couldn't start checkout. Nothing was charged.");
  }
}
