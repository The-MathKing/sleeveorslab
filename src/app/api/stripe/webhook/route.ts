import { NextResponse } from "next/server";
import { processWebhookEvent } from "@/lib/billing/logic";
import { billingContext, depsFor } from "@/lib/billing/server";
import { constructWebhookEvent } from "@/lib/billing/stripe";
import { jsonError, serverError } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../../billing/_lib/limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 512 * 1024;

/**
 * POST /api/stripe/webhook. Verifies the Stripe-Signature against the raw body, dedupes by
 * event id, then keeps subscription status, period end and pack credits in sync.
 * Events we don't handle get a 200 so Stripe stops retrying them.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.webhook);
  if (limited) return limited;
  const signature = req.headers.get("stripe-signature");
  if (!signature) return jsonError(400, "Missing Stripe-Signature header");
  const raw = await req.text();
  if (raw.length > MAX_WEBHOOK_BYTES) return jsonError(413, "Payload too large");

  let ctx;
  try {
    ctx = await billingContext();
  } catch (err) {
    return serverError(err, "Billing store unavailable");
  }
  const { store, config } = ctx;
  if (!config.webhookSecret) return jsonError(503, "Webhook signing secret isn't configured");

  let event;
  try {
    event = constructWebhookEvent(raw, signature, config.webhookSecret);
  } catch {
    return jsonError(400, "Invalid signature");
  }

  try {
    const outcome = await processWebhookEvent(event, depsFor(store, config));
    return NextResponse.json({ received: true, ...outcome });
  } catch (err) {
    // 500 → Stripe retries; processWebhookEvent already released the event id.
    return serverError(err, "Webhook handler failed");
  }
}
