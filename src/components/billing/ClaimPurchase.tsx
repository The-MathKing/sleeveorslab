"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { PLANS, type PaidPlanId } from "@/lib/billing/plans";
import { saveBillingToken } from "./client";

interface ClaimEntitlement {
  plan: string;
  isPro: boolean;
  creditsRemaining: number;
  renewsAt: string | null;
}

type State =
  | { kind: "loading" }
  | { kind: "done"; plan: PaidPlanId; entitlement: ClaimEntitlement }
  | { kind: "error"; message: string };

const RETRY_DELAYS_MS = [1500, 3000, 6000];

/** /pricing/success: swap the Checkout session id for an entitlement token, then say what they got. */
export function ClaimPurchase({ sessionId }: { sessionId: string | null }) {
  const [state, setState] = useState<State>(sessionId ? { kind: "loading" } : { kind: "error", message: "This page needs a checkout session. If you just paid, use Restore purchase." });

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`/api/billing/claim?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
          const j = (await res.json().catch(() => null)) as
            | { token?: string; plan?: PaidPlanId; entitlement?: ClaimEntitlement; error?: string }
            | null;
          if (cancelled) return;
          if (res.ok && j?.token && j.plan && j.entitlement) {
            saveBillingToken(j.token);
            setState({ kind: "done", plan: j.plan, entitlement: j.entitlement });
            return;
          }
          // 402 = Stripe hasn't marked it paid yet (rare, e.g. slow bank). Retry briefly.
          if ((res.status === 402 || res.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
            continue;
          }
          setState({ kind: "error", message: j?.error || "We couldn't confirm that checkout." });
          return;
        } catch {
          if (cancelled) return;
          if (attempt < RETRY_DELAYS_MS.length) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
            continue;
          }
          setState({ kind: "error", message: "You look offline. Reload this page once you're connected; you won't be charged again." });
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.kind === "loading") {
    return (
      <Card padding="lg" className="flex items-center gap-3">
        <Spinner label="" />
        <p className="text-ink-2">Confirming your payment with Stripe…</p>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card padding="lg">
        <h2 className="font-display text-2xl font-bold uppercase text-ink">Hmm, that didn&apos;t confirm</h2>
        <p className="mt-2 text-sm text-ink-2">{state.message}</p>
        <p className="mt-2 text-sm text-ink-2">
          If you were charged, your purchase is safe. Restore it with your checkout email, or write to hello@sleeveorslab.com.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/pricing/restore">Restore purchase</Button>
          <Button href="/scan" variant="outline">
            Back to scanning
          </Button>
        </div>
      </Card>
    );
  }

  const plan = PLANS[state.plan];
  const e = state.entitlement;
  return (
    <Card variant="slab" padding="lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-3xl font-bold uppercase text-ink">{plan.name}</h2>
        <Badge tone="slab">{state.plan === "pro-monthly" ? "Active" : "Credits added"}</Badge>
      </div>
      {state.plan === "pro-monthly" ? (
        <p className="mt-2 text-ink-2">
          Unlimited verdicts and binder triage are on for this browser.
          {e.renewsAt && (
            <>
              {" "}
              Renews <span className="font-mono">{new Date(e.renewsAt).toLocaleDateString()}</span> at{" "}
              <span className="font-mono">{plan.price}</span>. Cancel any time from &ldquo;Manage subscription&rdquo; on the pricing page.
            </>
          )}
        </p>
      ) : (
        <p className="mt-2 text-ink-2">
          You have <span className="font-mono font-semibold text-ink">{e.creditsRemaining}</span> scan credits. They never expire.
          Each full verdict past your free daily ones uses one.
        </p>
      )}
      <p className="mt-3 text-sm text-ink-3">
        A receipt is on its way from Stripe. Using another phone or browser? Use &ldquo;Restore purchase&rdquo; with the same email.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/scan" variant="slab">
          Back to scanning
        </Button>
        <Button href="/binder" variant="outline">
          Triage a binder
        </Button>
      </div>
    </Card>
  );
}
