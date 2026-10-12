"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sourceToken, track } from "@/lib/analytics/client";

type Status = "idle" | "sending" | "done" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Waitlist capture. POST /api/waitlist {email, source, consentMarketing}; count from GET /api/waitlist/count.
 * Degrades quietly if the API isn't there yet: the count line just doesn't render.
 */
export function WaitlistForm({ source = "landing", cta = "Join the waitlist" }: { source?: string; cta?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const emailId = useId();
  const consentId = useId();
  const errId = useId();
  const { toast } = useToast();

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/waitlist/count", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { count?: unknown } | null) => {
        if (j && typeof j.count === "number" && j.count > 0) setCount(j.count);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value, source, consentMarketing: consent }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; duplicate?: boolean; count?: number; error?: string } | null;
      if (!res.ok || !j) {
        throw new Error(res.status === 404 ? "The waitlist isn't open yet. Try again in a day or two." : j?.error || "Something broke on our end.");
      }
      if (typeof j.count === "number") setCount(j.count);
      if (!j.duplicate) track("waitlist_signup", { source: sourceToken(source) });
      setStatus("done");
      toast({
        tone: "good",
        title: j.duplicate ? "You were already on it." : "You're on the list.",
        description: "One email when Pro opens. That's it.",
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something broke on our end.");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-good/40 bg-good/10 p-4" role="status">
        <Check className="mt-0.5 size-5 shrink-0 text-good" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">You&apos;re on the list.</p>
          <p className="text-sm text-ink-2">
            {count ? (
              <>
                You and <span className="font-mono">{(count - 1).toLocaleString()}</span> other collectors. We&apos;ll email once when Pro opens.
              </>
            ) : (
              "We'll email once when Pro opens."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          required
          className="sm:flex-1"
        />
        <Button type="submit" variant="slab" loading={status === "sending"} iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
          {cta}
        </Button>
      </div>
      <Checkbox
        id={consentId}
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        label="Also send me the occasional Gem Rate Friday breakdown."
        description="Optional. Unchecked means we only email you about launch."
      />
      {error && (
        <p id={errId} role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      {count !== null && (
        <p className="font-mono text-xs text-ink-3">
          <span className="font-semibold text-ink">{count.toLocaleString()}</span> collectors on the list
        </p>
      )}
    </form>
  );
}
