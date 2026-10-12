import { NextResponse } from "next/server";
import { billingContext } from "@/lib/billing/server";
import { stripeClient } from "@/lib/billing/stripe";
import { requireAdmin } from "../../../_lib/admin";
import { jsonError } from "../../../_lib/http";
import { rateLimit } from "../../../_lib/rateLimit";
import { BILLING_LIMITS } from "../../../billing/_lib/limits";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/billing/test → can this Stripe account take money yet?
 * {ok, mode, account: {id, name, country, chargesEnabled, detailsSubmitted, payoutsEnabled, requirementsDue}}
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { config } = await billingContext();
    if (!config.secretKey) return jsonError(409, "No Stripe secret key configured");
    const a = await stripeClient(config.secretKey).accounts.retrieveCurrent();
    return NextResponse.json({
      ok: true,
      mode: config.mode,
      account: {
        id: a.id,
        name: a.business_profile?.name || a.settings?.dashboard?.display_name || null,
        country: a.country ?? null,
        chargesEnabled: a.charges_enabled,
        detailsSubmitted: a.details_submitted,
        payoutsEnabled: a.payouts_enabled,
        requirementsDue: a.requirements?.currently_due?.length ?? 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe request failed";
    return jsonError(502, `Stripe said: ${msg}`);
  }
}
