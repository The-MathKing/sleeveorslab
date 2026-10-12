"use client";

// Browser-side billing helpers: the entitlement token, the pricing-test arm, the public
// config, and the redirects to Stripe. No accounts: the token in localStorage IS the login.
import { useEffect, useState } from "react";
import { isVariant, type PaidPlanId, type PricingVariant, type PublicPlan } from "@/lib/billing/plans";

const TOKEN_KEY = "sos:billing-token";
const VARIANT_KEY = "sos:pricing-variant";
export const ENTITLEMENT_EVENT = "sos:entitlement-changed";

export function loadBillingToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveBillingToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: entitlement lasts for this page only */
  }
  try {
    window.dispatchEvent(new Event(ENTITLEMENT_EVENT));
  } catch {
    /* SSR */
  }
}

export function authHeaders(): Record<string, string> {
  const t = loadBillingToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

/* ---------------- public config ---------------- */

export interface PublicBillingConfig {
  enabled: boolean;
  mode: "test" | "live" | null;
  splitTest: boolean;
  plans: PublicPlan[];
}

let configPromise: Promise<PublicBillingConfig | null> | null = null;

export function fetchBillingConfig(): Promise<PublicBillingConfig | null> {
  configPromise ??= fetch("/api/billing/config", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PublicBillingConfig>) : null))
    .catch(() => null)
    .then((c) => {
      if (!c) configPromise = null; // retry next time
      return c;
    });
  return configPromise;
}

/** null while loading; payments read as off if the API is unreachable. */
export function useBillingConfig(): PublicBillingConfig | null {
  const [cfg, setCfg] = useState<PublicBillingConfig | null>(null);
  useEffect(() => {
    let live = true;
    fetchBillingConfig().then((c) => {
      if (live) setCfg(c ?? { enabled: false, mode: null, splitTest: false, plans: [] });
    });
    return () => {
      live = false;
    };
  }, []);
  return cfg;
}

/* ---------------- pricing test ---------------- */

/** Sticky 50/50 assignment per browser. Returns null when the test is off. */
export function pricingVariant(splitTest: boolean): PricingVariant | null {
  if (!splitTest) return null;
  try {
    const cur = localStorage.getItem(VARIANT_KEY);
    if (isVariant(cur)) return cur;
    const v: PricingVariant = Math.random() < 0.5 ? "monthly-first" : "pack-first";
    localStorage.setItem(VARIANT_KEY, v);
    return v;
  } catch {
    return null; // can't keep it sticky, so don't assign at all
  }
}

export function usePricingVariant(splitTest: boolean | undefined): PricingVariant | null {
  const [v, setV] = useState<PricingVariant | null>(null);
  useEffect(() => {
    setV(pricingVariant(!!splitTest));
  }, [splitTest]);
  return v;
}

/* ---------------- redirects ---------------- */

async function errorOf(res: Response, fallback: string): Promise<string> {
  const j = (await res.json().catch(() => null)) as { error?: string } | null;
  return j?.error || fallback;
}

/** Sends the browser to Stripe Checkout. Throws with a readable message on failure. */
export async function startCheckout(plan: PaidPlanId, variant: PricingVariant | null): Promise<void> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ plan, variant }),
  });
  if (!res.ok) throw new Error(await errorOf(res, "Couldn't start checkout"));
  const { url } = (await res.json()) as { url: string };
  window.location.assign(url);
}

/** Sends the browser to Stripe's customer portal (cancel, change card, invoices). */
export async function openBillingPortal(): Promise<void> {
  const res = await fetch("/api/billing/portal", { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(await errorOf(res, "Couldn't open the billing portal"));
  const { url } = (await res.json()) as { url: string };
  window.location.assign(url);
}
