"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { AnalyticsStats, EventName, FunnelStep } from "@/lib/analytics/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProbabilityBar";
import { Stat } from "@/components/ui/Stat";
import { cn } from "@/components/ui/cn";

/** Launch gate G1 (week 3): ≥500 waitlist signups and a median of ≥3 cards scanned per visitor. */
export const G1 = { waitlist: 500, medianVerdicts: 3 } as const;

const STEP_LABEL: Record<FunnelStep, string> = {
  page_view: "Visited",
  scan_started: "Started a scan",
  centering_done: "Measured centering",
  verdict_shown: "Saw a verdict",
  waitlist_signup: "Joined waitlist",
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "–");
const fmt = (n: number) => n.toLocaleString();

function PassFail({ pass }: { pass: boolean }) {
  return pass ? (
    <Badge tone="good" icon={<Check className="size-3" aria-hidden />}>
      Pass
    </Badge>
  ) : (
    <Badge tone="bad" icon={<X className="size-3" aria-hidden />}>
      Not yet
    </Badge>
  );
}

export function GateCard({ stats }: { stats: AnalyticsStats }) {
  const w = stats.waitlist.total;
  const m = stats.verdictsPerVisit.median;
  const wPass = w >= G1.waitlist;
  const mPass = stats.verdictsPerVisit.visits > 0 && m >= G1.medianVerdicts;
  return (
    <Card variant={wPass && mPass ? "slab" : "default"} as="section" aria-labelledby="g1-title">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle as="h2" id="g1-title">
            Gate G1 · week 3
          </CardTitle>
          <CardDescription>At least 500 waitlist signups and a median of at least 3 cards scanned per visitor.</CardDescription>
        </div>
        <PassFail pass={wPass && mPass} />
      </CardHeader>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <Stat label="Waitlist signups" value={fmt(w)} hint={`Target ${G1.waitlist} · all time · ${fmt(stats.waitlist.consenting)} opted in to email`} />
            <PassFail pass={wPass} />
          </div>
          <ProgressBar value={w / G1.waitlist} label={`${fmt(w)} of ${G1.waitlist}`} tone={wPass ? "good" : "slab"} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <Stat
              label="Median cards per visitor"
              value={stats.verdictsPerVisit.visits ? String(m) : "–"}
              hint={`Target ${G1.medianVerdicts} · verdicts per visit that saw ≥1 · last ${stats.days} days · n=${fmt(stats.verdictsPerVisit.visits)} · mean ${stats.verdictsPerVisit.mean}`}
              tone={mPass ? "good" : "ink"}
            />
            <PassFail pass={mPass} />
          </div>
          <ProgressBar value={m / G1.medianVerdicts} label={`${m} of ${G1.medianVerdicts}`} tone={mPass ? "good" : "slab"} />
        </div>
      </div>
    </Card>
  );
}

function FunnelBars({ steps }: { steps: AnalyticsStats["funnel"] }) {
  const top = steps[0]?.visits ?? 0;
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.visits : 0;
        return (
          <li key={s.step} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">{STEP_LABEL[s.step]}</span>
              <span className="font-mono tabular-nums text-ink-2">
                {fmt(s.visits)}
                {i > 0 ? <span className="ml-2 text-xs text-ink-3">{pct(s.visits, prev)} of prev</span> : null}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2 ring-1 ring-inset ring-line">
              <div className="h-full rounded-full bg-sleeve" style={{ width: top ? `${(s.visits / top) * 100}%` : 0 }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FunnelCard({ stats }: { stats: AnalyticsStats }) {
  const top = stats.funnel[0]?.visits ?? 0;
  const last = stats.funnel.at(-1)?.visits ?? 0;
  return (
    <Card as="section" aria-labelledby="funnel-title">
      <CardHeader>
        <CardTitle as="h2" id="funnel-title">
          Funnel
        </CardTitle>
        <CardDescription>
          Distinct visits that reached each step, last {stats.days} days. End to end: {pct(last, top)}.
        </CardDescription>
      </CardHeader>
      <FunnelBars steps={stats.funnel} />
    </Card>
  );
}

export function VerdictsCard({ stats }: { stats: AnalyticsStats }) {
  const v = stats.verdictsPerVisit;
  const max = Math.max(1, ...v.distribution.map((d) => d.visits));
  return (
    <Card as="section" aria-labelledby="vpv-title">
      <CardHeader>
        <CardTitle as="h2" id="vpv-title">
          Cards per visitor
        </CardTitle>
        <CardDescription>
          Verdicts shown per visit, among {fmt(v.visits)} visits that saw at least one. Median {v.visits ? v.median : "–"}, mean{" "}
          {v.visits ? v.mean : "–"}.
        </CardDescription>
      </CardHeader>
      <div className="flex h-36 items-end gap-2" role="img" aria-label="Distribution of verdicts per visit">
        {v.distribution.map((d) => (
          <div key={d.bucket} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[0.7rem] tabular-nums text-ink-2">{d.visits ? fmt(d.visits) : ""}</span>
            <div
              className={cn("w-full rounded-t-md", Number.parseInt(d.bucket, 10) >= G1.medianVerdicts ? "bg-slab" : "bg-sleeve")}
              style={{ height: `${(d.visits / max) * 100}%`, minHeight: d.visits ? 2 : 0 }}
              title={`${d.bucket} verdicts: ${d.visits} visits`}
            />
            <span className="font-mono text-[0.7rem] text-ink-3">{d.bucket}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

type Series = "visits" | EventName;
const SERIES: Array<{ value: Series; label: string }> = [
  { value: "visits", label: "Unique visits" },
  { value: "page_view", label: "Page views" },
  { value: "scan_started", label: "Scans started" },
  { value: "photo_captured", label: "Photos captured" },
  { value: "centering_done", label: "Centering done" },
  { value: "card_selected", label: "Cards selected" },
  { value: "verdict_shown", label: "Verdicts shown" },
  { value: "waitlist_signup", label: "Waitlist signups" },
  { value: "prediction_logged", label: "Predictions logged" },
  { value: "share_clicked", label: "Share taps" },
  { value: "qr_shown", label: "QR shown" },
  { value: "camera_unavailable", label: "Camera unavailable" },
  { value: "binder_evaluated", label: "Binder evaluations" },
];

export function DailyChart({ stats }: { stats: AnalyticsStats }) {
  const [series, setSeries] = useState<Series>("visits");
  const values = useMemo(
    () => stats.daily.map((d) => ({ day: d.day, n: series === "visits" ? d.visits : (d.counts[series] ?? 0) })),
    [stats.daily, series],
  );
  const max = Math.max(1, ...values.map((v) => v.n));
  const total = values.reduce((s, v) => s + v.n, 0);
  const H = 120;
  const slot = 10;
  const barW = values.length > 45 ? 8 : 7;
  const label = SERIES.find((s) => s.value === series)?.label ?? series;
  return (
    <Card as="section" aria-labelledby="daily-title">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle as="h2" id="daily-title">
            Daily
          </CardTitle>
          <CardDescription>
            {label}: {fmt(total)} total, peak {fmt(Math.max(0, ...values.map((v) => v.n)))}/day. Days are UTC.
          </CardDescription>
        </div>
        <div className="w-48">
          <Select
            aria-label="Series"
            selectSize="sm"
            value={series}
            onChange={(e) => setSeries(e.target.value as Series)}
            options={SERIES}
          />
        </div>
      </CardHeader>
      <div className="relative">
        <span className="absolute right-0 top-0 font-mono text-[0.65rem] text-ink-3">{fmt(max)}</span>
        <svg
          viewBox={`0 0 ${values.length * slot} ${H}`}
          preserveAspectRatio="none"
          className="block h-40 w-full"
          role="img"
          aria-label={`${label} per day`}
        >
          <line x1={0} x2={values.length * slot} y1={H - 0.5} y2={H - 0.5} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {values.map((v, i) => {
            const h = (v.n / max) * (H - 8);
            return (
              <rect
                key={v.day}
                x={i * slot + (slot - barW) / 2}
                y={H - h}
                width={barW}
                height={h}
                rx={1}
                fill={i === values.length - 1 ? "var(--slab)" : "var(--sleeve)"}
              >
                <title>{`${v.day}: ${fmt(v.n)}`}</title>
              </rect>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-ink-3">
          <span>{values[0]?.day}</span>
          <span>{values.at(-1)?.day}</span>
        </div>
      </div>
    </Card>
  );
}

export function ReferrersCard({ stats }: { stats: AnalyticsStats }) {
  const top = stats.topRefs[0]?.visits ?? 0;
  const total = stats.topRefs.reduce((s, r) => s + r.visits, 0);
  return (
    <Card as="section" aria-labelledby="refs-title">
      <CardHeader>
        <CardTitle as="h2" id="refs-title">
          Sources
        </CardTitle>
        <CardDescription>
          First referrer domain, utm_source, or &ldquo;qr&rdquo; per visit, with each source&apos;s funnel (visits → scan →
          centering → verdict → waitlist).
        </CardDescription>
      </CardHeader>
      {stats.topRefs.length === 0 ? (
        <p className="text-sm text-ink-3">No visits in this window yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-3">
                <th className="py-2 pr-2 font-semibold">Source</th>
                <th className="py-2 pr-2 font-semibold">Visits</th>
                <th className="py-2 pr-2 text-right font-semibold">Scan</th>
                <th className="py-2 pr-2 text-right font-semibold">Centering</th>
                <th className="py-2 pr-2 text-right font-semibold">Verdict</th>
                <th className="py-2 text-right font-semibold">Waitlist</th>
              </tr>
            </thead>
            <tbody>
              {stats.topRefs.map((r) => {
                const steps = stats.funnelBySource.find((f) => f.ref === r.ref)?.steps;
                const v = (s: FunnelStep) => steps?.find((x) => x.step === s)?.visits ?? 0;
                return (
                  <tr key={r.ref} className="border-b border-line/70 last:border-0">
                    <td className="max-w-[12rem] truncate py-2 pr-2 font-mono text-ink" title={r.ref}>
                      {r.ref}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="w-10 font-mono tabular-nums">{fmt(r.visits)}</span>
                        <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2 sm:block">
                          <span className="block h-full rounded-full bg-sleeve" style={{ width: `${(r.visits / (top || 1)) * 100}%` }} />
                        </span>
                        <span className="w-12 text-right font-mono text-xs text-ink-3">{pct(r.visits, total)}</span>
                      </div>
                    </td>
                    {steps ? (
                      (["scan_started", "centering_done", "verdict_shown", "waitlist_signup"] as const).map((s) => (
                        <td key={s} className="py-2 pr-2 text-right font-mono tabular-nums last:pr-0" title={`${pct(v(s), r.visits)} of visits`}>
                          {fmt(v(s))}
                        </td>
                      ))
                    ) : (
                      <td colSpan={4} className="py-2 text-right text-xs text-ink-3">
                        (not in top 8)
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
