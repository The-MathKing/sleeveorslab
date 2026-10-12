"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { saveBillingToken } from "./client";
import { ManageSubscriptionButton } from "./BuyButton";
import { useEntitlement } from "./useEntitlement";

type Exchange = { kind: "idle" } | { kind: "working" } | { kind: "done"; isPro: boolean; credits: number } | { kind: "error"; message: string };

/** /pricing/restore: request a magic link by email, or exchange one (?t=) for an entitlement token. */
export function RestorePurchase({ restoreToken }: { restoreToken: string | null }) {
  const [exchange, setExchange] = useState<Exchange>(restoreToken ? { kind: "working" } : { kind: "idle" });
  const ent = useEntitlement();

  useEffect(() => {
    if (!restoreToken) return;
    let cancelled = false;
    // Drop the token from the address bar (and from history) once we've read it.
    try {
      window.history.replaceState(null, "", "/pricing/restore");
    } catch {
      /* ignore */
    }
    fetch(`/api/billing/restore?t=${encodeURIComponent(restoreToken)}`, { cache: "no-store" })
      .then(async (res) => {
        const j = (await res.json().catch(() => null)) as
          | { token?: string; entitlement?: { isPro: boolean; creditsRemaining: number }; error?: string }
          | null;
        if (cancelled) return;
        if (res.ok && j?.token && j.entitlement) {
          saveBillingToken(j.token);
          setExchange({ kind: "done", isPro: j.entitlement.isPro, credits: j.entitlement.creditsRemaining });
        } else {
          setExchange({ kind: "error", message: j?.error || "That restore link didn't work." });
        }
      })
      .catch(() => !cancelled && setExchange({ kind: "error", message: "You look offline. Open the link again once you're connected." }));
    return () => {
      cancelled = true;
    };
  }, [restoreToken]);

  if (exchange.kind === "working") {
    return (
      <Card padding="lg" className="flex items-center gap-3">
        <Spinner label="" />
        <p className="text-ink-2">Restoring your purchase…</p>
      </Card>
    );
  }

  if (exchange.kind === "done") {
    return (
      <Card variant="slab" padding="lg">
        <h2 className="font-display text-3xl font-bold uppercase text-ink">Restored</h2>
        <p className="mt-2 text-ink-2">
          {exchange.isPro
            ? "Pro is on for this browser."
            : exchange.credits > 0
              ? `You have ${exchange.credits} scan credits on this browser.`
              : "We found your purchase, but there's nothing active on it right now (Pro ended, or the credits are used up)."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/scan" variant="slab">
            Back to scanning
          </Button>
          {exchange.isPro && <ManageSubscriptionButton />}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {exchange.kind === "error" && (
        <Card variant="borderline" padding="md" role="alert">
          <p className="text-sm text-ink">{exchange.message}</p>
        </Card>
      )}
      {ent.hasToken && !ent.loading && (ent.isPro || ent.credits > 0) && (
        <Card padding="lg">
          <h2 className="font-display text-2xl font-bold uppercase text-ink">This browser already has it</h2>
          <p className="mt-1 text-sm text-ink-2">
            {ent.isPro ? "Pro is active here." : `${ent.credits} scan credits here.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ManageSubscriptionButton />
            <Button href="/scan" variant="ghost">
              Back to scanning
            </Button>
          </div>
        </Card>
      )}
      <RestoreForm />
    </div>
  );
}

function RestoreForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (res.ok) setMessage(j?.message ?? "Check your inbox.");
      else setError(j?.error ?? "Something went wrong. Try again in a few minutes.");
    } catch {
      setError("You look offline. Try again once you're connected.");
    } finally {
      setBusy(false);
    }
  }

  if (message) {
    return (
      <Card padding="lg">
        <h2 className="font-display text-2xl font-bold uppercase text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-ink-2">{message}</p>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <h2 className="font-display text-2xl font-bold uppercase text-ink">Email me a restore link</h2>
      <p className="mb-4 mt-1 text-sm text-ink-2">
        Use the email you typed at checkout. The link works for 30 minutes; open it on the phone or browser you want your plan on. From there,
        &ldquo;Manage subscription&rdquo; lets you cancel.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Checkout email" error={error ?? undefined} className="flex-1">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Button type="submit" loading={busy} disabled={!email.trim()}>
          Send link
        </Button>
      </form>
    </Card>
  );
}
