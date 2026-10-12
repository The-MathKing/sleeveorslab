import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  BillingKeyMissingError,
  envKey,
  issueEntitlementToken,
  issueRestoreToken,
  rootSecret,
  verifyToken,
} from "@/lib/billing/crypto";
import { getBillingStore } from "@/lib/billing/db";
import { resendConfigured, sendRestoreEmail, SUPPORT_EMAIL } from "@/lib/billing/email";
import { bestCustomer, entitlementFor } from "@/lib/billing/logic";
import { siteOrigin } from "@/lib/billing/server";
import { normalizeBillingEmail } from "@/lib/billing/store";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../_lib/http";
import { rateLimit } from "../../_lib/rateLimit";
import { BILLING_LIMITS } from "../_lib/limits";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().trim().max(254).pipe(z.email("Invalid email")) });

const GENERIC =
  "If that email has a Sleeve or Slab purchase, a restore link is on its way. It works for 30 minutes. Check spam if it doesn't show up.";
const MANUAL = `Email ${SUPPORT_EMAIL} from the address you used at checkout and we'll restore your purchase by hand.`;

// Per-email cooldown on top of the per-IP limit (process-local, like the IP limiter).
const lastSent = new Map<string, number>();
const EMAIL_COOLDOWN_MS = 2 * 60_000;

/** POST /api/billing/restore {email} → always the same generic answer, whether or not the email bought anything. */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.restoreRequest);
  if (limited) return limited;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  if (!resendConfigured() || !rootSecret()) return NextResponse.json({ ok: true, emailed: false, message: MANUAL });

  const email = normalizeBillingEmail(parsed.data.email);
  const now = Date.now();
  for (const [k, t] of lastSent) if (now - t > EMAIL_COOLDOWN_MS) lastSent.delete(k);
  if (!lastSent.has(email)) {
    lastSent.set(email, now);
    const origin = siteOrigin(req, { forEmail: true });
    // Look up + send after responding, so response time doesn't reveal whether the email exists.
    after(async () => {
      try {
        const customers = await getBillingStore().findCustomersByEmail(email);
        if (!customers.length) return;
        const t = issueRestoreToken(email, envKey("restore"));
        await sendRestoreEmail(email, `${origin}/pricing/restore?t=${encodeURIComponent(t)}`);
      } catch (err) {
        console.error("[billing] restore send failed", err);
      }
    });
  }
  return NextResponse.json({ ok: true, emailed: true, message: GENERIC });
}

const tokenSchema = z.string().min(10).max(2048);

/** GET /api/billing/restore?t=<restore token> → { token, entitlement } (exchanges the emailed link). */
export async function GET(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.restoreExchange);
  if (limited) return limited;
  const parsed = tokenSchema.safeParse(new URL(req.url).searchParams.get("t") ?? "");
  if (!parsed.success) return jsonError(400, "Invalid restore link");
  try {
    const v = verifyToken(parsed.data, envKey("restore"), "restore");
    if (!v.ok) {
      return jsonError(v.reason === "expired" ? 410 : 400, v.reason === "expired" ? "That restore link has expired. Request a new one." : "Invalid restore link");
    }
    const c = bestCustomer(await getBillingStore().findCustomersByEmail(v.claims.em));
    if (!c) return jsonError(404, `No purchase found for that email. ${MANUAL}`);
    return NextResponse.json(
      { token: issueEntitlementToken(c.id, envKey("entitlement")), entitlement: entitlementFor(c) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof BillingKeyMissingError) return jsonError(503, MANUAL);
    return serverError(err);
  }
}
