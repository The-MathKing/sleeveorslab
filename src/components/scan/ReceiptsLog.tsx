"use client";
import Link from "next/link";
import { Receipt as ReceiptIcon, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Prediction, Verdict } from "@/lib/types";
import { listPredictionsApi, pct } from "./format";
import { EmptyState, ErrorNote, Segmented, Skeleton, TextInput } from "./parts";
import { ReceiptCard, receiptStats } from "./Receipt";

type Status = "all" | "pending" | "graded";

export function ReceiptsLog() {
  const [list, setList] = useState<Prediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<Status>("all");
  const [verdict, setVerdict] = useState<"" | Verdict>("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    listPredictionsApi(200, ctrl.signal)
      .then((x) => setList(x))
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't load the log.");
      });
    return () => ctrl.abort();
  }, [nonce]);

  const stats = useMemo(() => receiptStats(list ?? []), [list]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list ?? [])
      .filter((p) => (status === "all" ? true : status === "graded" ? !!p.outcome : !p.outcome))
      .filter((p) => !verdict || p.verdict === verdict)
      .filter((p) => !term || `${p.id} ${p.card.name} ${p.card.setName} ${p.card.number}`.toLowerCase().includes(term));
  }, [list, status, verdict, q]);

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Logged" value={list ? String(stats.logged) : undefined} />
        <Stat label="Graded" value={list ? String(stats.resolved) : undefined} />
        <Stat label="Hit rate" value={list ? (stats.hitRate === undefined ? "—" : pct(stats.hitRate)) : undefined} hint="realized = most-likely grade" />
        <Stat label="Brier P(10)" value={list ? (stats.brier === undefined ? "—" : stats.brier.toFixed(3)) : undefined} hint="lower is better; 0.25 = coin flip" />
      </dl>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          label="Outcome"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "graded", label: "Graded" },
          ]}
        />
        <label className="sr-only" htmlFor="rc-verdict">
          Verdict
        </label>
        <select
          id="rc-verdict"
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as "" | Verdict)}
          className="min-h-11 rounded-xl border border-line bg-card px-2 text-sm text-ink"
        >
          <option value="">Any verdict</option>
          <option value="SLAB">Slab</option>
          <option value="BORDERLINE">Borderline</option>
          <option value="SLEEVE">Sleeve</option>
        </select>
        <label className="sr-only" htmlFor="rc-q">
          Search receipts
        </label>
        <TextInput id="rc-q" type="search" placeholder="Card or R-number" value={q} onChange={(e) => setQ(e.target.value)} className="sm:flex-1" />
      </div>

      {error ? (
        <ErrorNote onRetry={() => setNonce((n) => n + 1)}>{error}</ErrorNote>
      ) : !list ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon className="size-8" aria-hidden />}
          title="No receipts yet"
          body="Be the first: scan a card, then tap “Log publicly” on the verdict. We'll check it against the real grade."
          action={
            <Link href="/scan" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-paper">
              <ScanLine className="size-4" aria-hidden /> Scan a card
            </Link>
          }
        />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">Nothing matches those filters.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/receipts/${encodeURIComponent(p.id)}`} className="block rounded-sm transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ink">
                <ReceiptCard p={p} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value?: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-card p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{value ?? <Skeleton className="h-7 w-14" />}</dd>
      {hint ? <dd className="text-[11px] leading-tight text-ink-3">{hint}</dd> : null}
    </div>
  );
}
