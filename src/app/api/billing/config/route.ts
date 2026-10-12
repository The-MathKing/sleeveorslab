import { NextResponse } from "next/server";
import { fallbackPublicConfig, publicView } from "@/lib/billing/config";
import { billingContext } from "@/lib/billing/server";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

/** GET /api/billing/config → { enabled, mode, splitTest, plans }. Never fails: payments just read as off. */
export async function GET(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.config);
  if (limited) return limited;
  let body = fallbackPublicConfig();
  try {
    const { config } = await billingContext();
    body = publicView(config);
  } catch (err) {
    console.error("[billing] config unavailable", err);
  }
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
