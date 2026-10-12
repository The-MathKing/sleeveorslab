import { NextResponse } from "next/server";
import { z } from "zod";
import { adminView } from "@/lib/billing/config";
import { encryptSecret, envKey, keyMode, last4, rootSecret } from "@/lib/billing/crypto";
import { WEBHOOK_EVENTS } from "@/lib/billing/logic";
import { billingContext } from "@/lib/billing/server";
import type { SettingsPatch } from "@/lib/billing/store";
import { requireAdmin } from "../../../_lib/admin";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../../_lib/http";
import { rateLimit } from "../../../_lib/rateLimit";
import { BILLING_LIMITS } from "../../../billing/_lib/limits";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** GET /api/admin/billing/settings → masked status (never secrets). */
export async function GET(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { config } = await billingContext();
    return NextResponse.json({ settings: adminView(config), webhookEvents: WEBHOOK_EVENTS }, { headers: NO_STORE });
  } catch (err) {
    return serverError(err);
  }
}

const bodySchema = z
  .object({
    // "" or null clears a stored secret.
    secretKey: z
      .string()
      .trim()
      .max(255)
      .regex(/^((sk|rk)_(test|live)_[A-Za-z0-9]{10,})?$/, "Secret key should start with sk_test_, sk_live_, rk_test_ or rk_live_")
      .nullish(),
    webhookSecret: z
      .string()
      .trim()
      .max(255)
      .regex(/^(whsec_[A-Za-z0-9+/=_-]{10,})?$/, "Webhook signing secret should start with whsec_")
      .nullish(),
    paymentsEnabled: z.boolean().optional(),
    splitTest: z.boolean().optional(),
  })
  .strict();

/** POST /api/admin/billing/settings {secretKey?, webhookSecret?, paymentsEnabled?, splitTest?} */
export async function POST(req: Request) {
  const limited = rateLimit(req, BILLING_LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  const input = parsed.data;

  try {
    const { store, config } = await billingContext();
    const patch: SettingsPatch = {};

    if (input.secretKey !== undefined || input.webhookSecret !== undefined) {
      if (!rootSecret()) return jsonError(503, "Set ADMIN_TOKEN or BILLING_ENCRYPTION_KEY before storing keys");
      const key = envKey("encryption");
      if (input.secretKey !== undefined) {
        const sk = input.secretKey || null;
        patch.secretKeyEnc = sk ? encryptSecret(sk, key) : null;
        patch.secretKeyLast4 = sk ? last4(sk) : null;
        patch.secretKeyMode = sk ? keyMode(sk) : null;
        // New key = possibly a new account or mode: old price ids are meaningless there, and
        // payments go back off until the admin re-syncs and re-enables on purpose.
        if (!process.env.STRIPE_SECRET_KEY) {
          patch.priceIds = {};
          patch.paymentsEnabled = false;
        }
      }
      if (input.webhookSecret !== undefined) {
        const wh = input.webhookSecret || null;
        patch.webhookSecretEnc = wh ? encryptSecret(wh, key) : null;
        patch.webhookSecretLast4 = wh ? last4(wh) : null;
      }
    }

    if (input.splitTest !== undefined) patch.splitTest = input.splitTest;

    if (input.paymentsEnabled === true && patch.paymentsEnabled === undefined) {
      if (!config.secretKey) return jsonError(409, "Add a Stripe secret key first");
      if (!config.pricesSynced) return jsonError(409, "Create products & prices first");
      if (!config.webhookSecret) return jsonError(409, "Add the webhook signing secret first, or purchases won't stay in sync");
      patch.paymentsEnabled = true;
    } else if (input.paymentsEnabled === false) {
      patch.paymentsEnabled = false;
    }

    await store.updateSettings(patch);
    const { config: next } = await billingContext();
    return NextResponse.json({ settings: adminView(next), webhookEvents: WEBHOOK_EVENTS }, { headers: NO_STORE });
  } catch (err) {
    return serverError(err);
  }
}
