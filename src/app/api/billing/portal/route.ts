import { NextResponse } from "next/server";
import { billingContext, bearerCustomerId, siteOrigin } from "@/lib/billing/server";
import { stripeClient } from "@/lib/billing/stripe";
import { jsonError, serverError } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/portal (Bearer) → {url} for Stripe's customer portal (cancel, card, invoices).
 * Works even when new payments are switched off, so anyone can always cancel.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.portal);
  if (limited) return limited;
  const cid = bearerCustomerId(req);
  if (!cid) return jsonError(401, "Missing or invalid entitlement token");
  try {
    const { store, config } = await billingContext();
    if (!config.secretKey) return jsonError(503, "Billing isn't configured. Email hello@sleeveorslab.com and we'll sort it out by hand.");
    const c = await store.getCustomer(cid);
    if (!c) return jsonError(401, "Unknown purchase");
    const portal = await stripeClient(config.secretKey).billingPortal.sessions.create({
      customer: c.id,
      return_url: `${siteOrigin(req)}/pricing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    return serverError(err, "Couldn't open the billing portal. Email hello@sleeveorslab.com and we'll cancel by hand.");
  }
}
