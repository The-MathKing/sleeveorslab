"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanId } from "@/lib/billing/plans";
import { authHeaders, ENTITLEMENT_EVENT, loadBillingToken, saveBillingToken } from "./client";

export interface EntitlementState {
  plan: PlanId;
  /** Subscription status, "credits", "canceled", or "none". */
  status: string;
  isPro: boolean;
  /** Pack credits left (0 when none). Pro is unlimited regardless. */
  credits: number;
  renewsAt: string | null;
  endsAt: string | null;
  /** This browser holds a purchase token. */
  hasToken: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Spend `n` credits. Pro: always ok, nothing spent. Pack: atomic server-side decrement.
   * ok=false when there aren't enough credits or there's no purchase on this browser.
   */
  consume: (n?: number) => Promise<{ ok: boolean; creditsRemaining: number; unlimited: boolean }>;
}

interface MeResponse {
  plan: PlanId;
  status: string;
  isPro: boolean;
  creditsRemaining: number;
  renewsAt: string | null;
  endsAt: string | null;
}

const FREE: MeResponse = { plan: "free", status: "none", isPro: false, creditsRemaining: 0, renewsAt: null, endsAt: null };

/** What this browser is entitled to. Free (and no network call) when there's no token. */
export function useEntitlement(): EntitlementState {
  const [me, setMe] = useState<MeResponse>(FREE);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    const token = loadBillingToken();
    setHasToken(!!token);
    if (!token) {
      setMe(FREE);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/me", { headers: authHeaders(), cache: "no-store" });
      if (id !== seq.current) return;
      if (res.status === 401) {
        // Token no longer valid (key rotated / purchase removed). Restore fixes it.
        saveBillingToken(null);
        setHasToken(false);
        setMe(FREE);
      } else if (res.ok) {
        setMe((await res.json()) as MeResponse);
      }
      // Other errors: keep the last known state rather than downgrading a paying user.
    } catch {
      /* offline: keep last known state */
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "sos:billing-token") void refresh();
    };
    window.addEventListener(ENTITLEMENT_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ENTITLEMENT_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const consume = useCallback(async (n = 1) => {
    if (!loadBillingToken()) return { ok: false, creditsRemaining: 0, unlimited: false };
    try {
      const res = await fetch("/api/billing/consume", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ count: n }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; creditsRemaining?: number; unlimited?: boolean } | null;
      const out = { ok: res.ok && !!j?.ok, creditsRemaining: j?.creditsRemaining ?? 0, unlimited: !!j?.unlimited };
      if (res.ok || res.status === 402) setMe((m) => ({ ...m, creditsRemaining: out.creditsRemaining, plan: m.isPro ? m.plan : out.creditsRemaining > 0 ? "pack-100" : "free" }));
      return out;
    } catch {
      return { ok: false, creditsRemaining: me.creditsRemaining, unlimited: false };
    }
  }, [me.creditsRemaining]);

  return {
    plan: me.plan,
    status: me.status,
    isPro: me.isPro,
    credits: me.creditsRemaining,
    renewsAt: me.renewsAt,
    endsAt: me.endsAt,
    hasToken,
    loading,
    refresh,
    consume,
  };
}
