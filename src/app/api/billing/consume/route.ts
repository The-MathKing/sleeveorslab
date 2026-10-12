import { NextResponse } from "next/server";
import { z } from "zod";
import { getBillingStore } from "@/lib/billing/db";
import { entitlementFor } from "@/lib/billing/logic";
import { bearerCustomerId } from "@/lib/billing/server";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ count: z.int().min(1).max(500) });

/**
 * POST /api/billing/consume {count} (Bearer) → {ok, creditsRemaining, unlimited}.
 * Active Pro is unlimited (nothing decremented). Packs decrement atomically; 402 when short.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.consume);
  if (limited) return limited;
  const cid = bearerCustomerId(req);
  if (!cid) return jsonError(401, "Missing or invalid entitlement token");
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  try {
    const store = getBillingStore();
    const c = await store.getCustomer(cid);
    if (!c) return jsonError(401, "Unknown purchase");
    if (entitlementFor(c).isPro) return NextResponse.json({ ok: true, creditsRemaining: c.credits, unlimited: true });
    const r = await store.consumeCredits(cid, parsed.data.count);
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, creditsRemaining: r.creditsRemaining, unlimited: false, error: "Not enough scan credits" },
        { status: 402 },
      );
    }
    return NextResponse.json({ ok: true, creditsRemaining: r.creditsRemaining, unlimited: false });
  } catch (err) {
    return serverError(err);
  }
}
