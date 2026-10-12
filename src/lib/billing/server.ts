// Request-level helpers shared by the billing route handlers.
import { BillingKeyMissingError, envKey, verifyToken } from "./crypto";
import { resolveBillingConfig, type ResolvedBillingConfig } from "./config";
import { getBillingStore } from "./db";
import { stripeClient } from "./stripe";
import type { BillingDeps } from "./logic";
import type { BillingStore } from "./store";

export async function billingContext(): Promise<{ store: BillingStore; config: ResolvedBillingConfig }> {
  const store = getBillingStore();
  return { store, config: await resolveBillingConfig(store) };
}

export function depsFor(store: BillingStore, config: ResolvedBillingConfig): BillingDeps {
  const sk = config.secretKey;
  return {
    store,
    retrieveSubscription: sk ? (id) => stripeClient(sk).subscriptions.retrieve(id) : undefined,
  };
}

/** Customer id from `Authorization: Bearer <entitlement token>`, or null. */
export function bearerCustomerId(req: Request): string | null {
  const h = req.headers.get("authorization");
  const m = h ? /^Bearer\s+(\S+)$/i.exec(h.trim()) : null;
  if (!m) return null;
  try {
    const v = verifyToken(m[1]!, envKey("entitlement"), "ent");
    return v.ok ? v.claims.cid : null;
  } catch (err) {
    if (err instanceof BillingKeyMissingError) return null;
    throw err;
  }
}

const PROD_ORIGIN = "https://www.sleeveorslab.com";

/**
 * Origin for redirect/email links. Email links never trust the Host header (reset-link
 * poisoning): they use NEXT_PUBLIC_SITE_URL, or the production origin.
 */
export function siteOrigin(req: Request, { forEmail = false } = {}): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (forEmail) {
    if (configured && (process.env.NODE_ENV !== "production" || configured.startsWith("https://"))) return configured;
    return process.env.NODE_ENV === "production" ? PROD_ORIGIN : new URL(req.url).origin;
  }
  return new URL(req.url).origin;
}
