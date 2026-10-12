"use client";
import clsx from "clsx";
import { Check, Mail, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { sourceToken, track } from "@/lib/analytics/client";
import { markWaitlistDismissed, markWaitlistJoined } from "@/lib/store";
import { joinWaitlist } from "./format";
import { Btn, TextInput } from "./parts";

export function EmailCapture({
  source,
  title,
  body,
  tone = "plain",
  onDone,
  dismissible = true,
}: {
  source: string;
  title: ReactNode;
  body?: ReactNode;
  tone?: "plain" | "slab";
  onDone?: () => void;
  dismissible?: boolean;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setState("error");
      setMsg("That email doesn't look right.");
      return;
    }
    setState("sending");
    try {
      const r = await joinWaitlist(email.trim(), source, consent);
      markWaitlistJoined();
      if (!r.duplicate) track("waitlist_signup", { source: sourceToken(source) });
      setState("done");
      setMsg(r.duplicate ? "You were already on the list. We'll be in touch." : `You're in. ${r.count ? `#${r.count} on the list.` : ""}`);
      onDone?.();
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Couldn't join right now. Try again in a bit.");
    }
  }

  return (
    <aside
      className={clsx(
        "relative rounded-[var(--radius)] border p-4",
        tone === "slab" ? "border-slab/40 bg-slab-soft" : "border-line bg-card",
      )}
    >
      {dismissible && state !== "done" ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            markWaitlistDismissed();
            setHidden(true);
          }}
          className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-ink-3 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
      <div className="pr-8">
        <p className="flex items-center gap-2 font-display text-base font-semibold">
          <Mail className="size-4" aria-hidden /> {title}
        </p>
        {body ? <p className="mt-1 text-sm text-ink-2">{body}</p> : null}
      </div>
      {state === "done" ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-good" role="status">
          <Check className="size-4" aria-hidden /> {msg}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2" noValidate>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={id} className="sr-only">
              Email
            </label>
            <TextInput id={id} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Btn type="submit" variant="primary" loading={state === "sending"} className="sm:w-auto">
              Join waitlist
            </Btn>
          </div>
          <label className="flex min-h-9 items-start gap-2 text-xs text-ink-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Also send me occasional product news. (Unchecked = we only email you about launch.)
          </label>
          {state === "error" ? (
            <p role="alert" className="text-sm text-bad">
              {msg}
            </p>
          ) : null}
        </form>
      )}
    </aside>
  );
}
