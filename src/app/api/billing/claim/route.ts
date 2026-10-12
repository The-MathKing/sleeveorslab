import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingKeyMissingError, envKey, issueEntitlementToken } from "@/lib/billing/crypto";
import { depsFor, billingContext } from "@/lib/billing/server";
import { entitlementFor, fulfillCheckoutSession } from "@/lib/billing/logic";
import { stripeClient } from "@/lib/billing/stripe";
import { jsonError, serverError } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

const sessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{8,240}$/, "Invalid session id");
/** Claims are for the success page right after checkout. Later, use "Restore purchase". */
const CLAIM_WINDOW_MS = 48 * 3_600_000;

/** GET /api/billing/claim?session_id=cs_... → { token, entitlement } once Stripe confirms payment. */
export async function GET(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.claim);
  if (limited) return limited;
  const parsed = sessionIdSchema.safeParse(new URL(req.url).searchParams.get("session_id") ?? "");
  if (!parsed.success) return jsonError(400, "Invalid session id");

  try {
    const { store, config } = await billingContext();
    if (!config.secretKey) return jsonError(503, "Billing isn't configured");
    const key = envKey("entitlement");

    let session;
    try {
      session = await stripeClient(config.secretKey).checkout.sessions.retrieve(parsed.data, { expand: ["subscription"] });
    } catch {
      return jsonError(404, "Checkout session not found");
    }
    if (Date.now() - session.created * 1000 > CLAIM_WINDOW_MS) {
      return jsonError(410, "This checkout link has expired. Use \"Restore purchase\" with your checkout email.");
    }
    const r = await fulfillCheckoutSession(session, depsFor(store, config));
    if (!r.ok) {
      if (r.reason === "not-paid") return jsonError(402, "That checkout isn't paid yet. If you just paid, refresh in a few seconds.");
      return jsonError(404, "Checkout session not found");
    }
    const entitlement = entitlementFor(await store.getCustomer(r.customerId));
    return NextResponse.json(
      { token: issueEntitlementToken(r.customerId, key), plan: r.plan, entitlement },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof BillingKeyMissingError) return jsonError(503, "Billing isn't configured");
    return serverError(err, "Couldn't confirm the purchase. Try again in a minute; you won't be charged twice.");
  }
}
