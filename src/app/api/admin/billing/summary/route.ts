import { NextResponse } from "next/server";
import { billingContext } from "@/lib/billing/server";
import { requireAdmin } from "../../../_lib/admin";
import { serverError } from "../../../_lib/http";
import { rateLimit } from "../../../_lib/rateLimit";
import { BILLING_LIMITS } from "../../../billing/_lib/limits";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

/**
 * GET /api/admin/billing/summary → active subs, packs sold, checkout revenue (30d) and
 * conversions per pricing-test arm, counted for the current key's mode (test or live).
 */
export async function GET(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { store, config } = await billingContext();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const summary = await store.summary({ since, livemode: config.mode ? config.mode === "live" : null });
    return NextResponse.json({ mode: config.mode, windowDays: WINDOW_DAYS, summary }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
