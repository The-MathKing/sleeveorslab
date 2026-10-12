import { NextResponse } from "next/server";
import { entitlementFor } from "@/lib/billing/logic";
import { bearerCustomerId } from "@/lib/billing/server";
import { getBillingStore } from "@/lib/billing/db";
import { jsonError, serverError } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

/** GET /api/billing/me (Bearer) → { plan, status, isPro, creditsRemaining, renewsAt, endsAt }. Works without Stripe. */
export async function GET(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.me);
  if (limited) return limited;
  const cid = bearerCustomerId(req);
  if (!cid) return jsonError(401, "Missing or invalid entitlement token");
  try {
    const c = await getBillingStore().getCustomer(cid);
    if (!c) return jsonError(401, "Unknown purchase");
    return NextResponse.json(entitlementFor(c), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
