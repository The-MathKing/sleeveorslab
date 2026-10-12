"use client";
import { Printer, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/client";
import type { Grade } from "@/lib/types";
import { Button } from "@/components/ui";
import { Btn, FieldLabel, TextInput } from "./parts";

export function ReceiptToolbar({ id, title }: { id: string; title: string }) {
  const [msg, setMsg] = useState("");
  const share = async () => {
    track("share_clicked");
    const url = `${location.origin}/receipts/${encodeURIComponent(id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg("Link copied.");
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Btn size="sm" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden /> Print
      </Btn>
      <Btn size="sm" onClick={share}>
        <Share2 className="size-4" aria-hidden /> Share link
      </Btn>
      {msg ? (
        <span className="text-sm text-ink-2" role="status">
          {msg}
        </span>
      ) : null}
    </div>
  );
}

export function ReportOutcome({ id, grader }: { id: string; grader: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState<Grade | "">("");
  const [cert, setCert] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [err, setErr] = useState("");
  const [token, setToken] = useState("");
  // Outcomes are written by an admin after checking the cert, so the public log can't be
  // rewritten by anyone with the URL. Visitors email the cert; /receipts/R-0001?admin=1 shows the form.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      setIsAdmin(new URLSearchParams(window.location.search).get("admin") === "1");
    } catch {
      /* no-op */
    }
  }, []);

  if (!isAdmin) {
    const subject = encodeURIComponent(`Grade for receipt ${id}`);
    const body = encodeURIComponent(`Receipt: ${id}\nGrader: ${grader}\nGrade:\nCert number:\n`);
    return (
      <div className="flex flex-col gap-1 print:hidden">
        <Button size="sm" variant="ghost" href={`mailto:hello@sleeveorslab.com?subject=${subject}&body=${body}`}>
          Got the grade back? Send us the cert
        </Button>
        <p className="text-xs text-ink-3">We verify every cert number before it goes on the log.</p>
      </div>
    );
  }

  if (!open)
    return (
      <Btn size="sm" variant="ghost" className="print:hidden" onClick={() => setOpen(true)}>
        Record verified grade
      </Btn>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) return;
    setState("sending");
    try {
      const res = await fetch(`/api/predictions/${encodeURIComponent(id)}/outcome`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ grade, certNumber: cert.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      router.refresh();
      setOpen(false);
      setState("idle");
    } catch (e2) {
      setState("error");
      setErr(e2 instanceof Error ? e2.message : "Couldn't save.");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[var(--radius)] border border-line bg-card p-4 print:hidden">
      <p className="text-sm text-ink-2">
        Report the {grader} grade this card actually got. The cert number lets anyone verify it.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="oc-grade">Grade</FieldLabel>
          <select
            id="oc-grade"
            required
            value={grade}
            onChange={(e) => setGrade(e.target.value ? (Number(e.target.value) as Grade) : "")}
            className="min-h-11 w-full rounded-xl border border-line bg-card px-2 font-mono text-ink"
          >
            <option value="">—</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => (
              <option key={g} value={g}>
                {grader} {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="oc-cert">Cert # (optional)</FieldLabel>
          <TextInput id="oc-cert" inputMode="numeric" value={cert} onChange={(e) => setCert(e.target.value)} className="font-mono" />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="oc-token">Admin token</FieldLabel>
        <TextInput id="oc-token" type="password" autoComplete="off" required value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Btn type="submit" variant="primary" loading={state === "sending"} disabled={!grade}>
          Submit grade
        </Btn>
        <Btn type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Btn>
      </div>
      {state === "error" ? (
        <p className="text-sm text-bad" role="alert">
          {err}
        </p>
      ) : null}
    </form>
  );
}
