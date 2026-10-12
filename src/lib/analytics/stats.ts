// Pure aggregation helpers shared by every storage adapter.
import {
  DIRECT_REF,
  EVENT_NAMES,
  FUNNEL_STEPS,
  type AnalyticsStats,
  type EventName,
  type StatsRows,
} from "./types";

const DAY_MS = 86_400_000;

export function clampDays(days: number | undefined): number {
  const d = Math.trunc(Number(days ?? 30));
  return Number.isFinite(d) ? Math.min(Math.max(d, 1), 90) : 30;
}

/** UTC yyyy-mm-dd. */
export function dayKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** Start of the window: midnight UTC, `days - 1` days before today (so today is included). */
export function windowStart(now: Date, days: number): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (clampDays(days) - 1) * DAY_MS);
}

/** Median of a histogram of integer values. Mean of the two middle values for even counts. */
export function histMedian(hist: Array<{ value: number; count: number }>): number {
  const sorted = hist.filter((h) => h.count > 0).sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, h) => s + h.count, 0);
  if (!total) return 0;
  const at = (k: number) => {
    let seen = 0;
    for (const h of sorted) {
      seen += h.count;
      if (k < seen) return h.value;
    }
    return sorted[sorted.length - 1]!.value;
  };
  return total % 2 ? at((total - 1) / 2) : (at(total / 2 - 1) + at(total / 2)) / 2;
}

const isEventName = (s: string): s is EventName => (EVENT_NAMES as readonly string[]).includes(s);

export function finalizeStats(rows: StatsRows, opts: { days: number; now: Date }): AnalyticsStats {
  const days = clampDays(opts.days);
  const start = windowStart(opts.now, days);

  const daily: AnalyticsStats["daily"] = [];
  const byDay = new Map<string, AnalyticsStats["daily"][number]>();
  for (let i = 0; i < days; i++) {
    const day = dayKey(new Date(start.getTime() + i * DAY_MS));
    const entry = { day, visits: 0, counts: {} };
    daily.push(entry);
    byDay.set(day, entry);
  }
  for (const r of rows.dailyCounts) {
    const e = byDay.get(r.day);
    if (e && isEventName(r.name)) e.counts[r.name] = (e.counts[r.name] ?? 0) + Number(r.n);
  }
  for (const r of rows.dailyVisits) {
    const e = byDay.get(r.day);
    if (e) e.visits = Number(r.n);
  }

  const perSource = new Map<string, Map<string, number>>();
  for (const r of rows.sourceSteps) {
    const ref = r.ref || DIRECT_REF;
    let m = perSource.get(ref);
    if (!m) perSource.set(ref, (m = new Map()));
    m.set(r.name, (m.get(r.name) ?? 0) + Number(r.n));
  }
  const stepsFor = (m: Map<string, number> | undefined) =>
    FUNNEL_STEPS.map((step) => ({ step, visits: m?.get(step) ?? 0 }));
  const totals = new Map<string, number>();
  for (const m of perSource.values()) for (const [k, v] of m) totals.set(k, (totals.get(k) ?? 0) + v);

  const refsRanked = [...perSource.entries()]
    .map(([ref, m]) => ({ ref, visits: m.get("page_view") ?? 0 }))
    .filter((r) => r.visits > 0)
    .sort((a, b) => b.visits - a.visits || a.ref.localeCompare(b.ref));

  const hist = rows.verdictHist.map((h) => ({ value: Number(h.verdicts), count: Number(h.visits) }));
  const scanVisits = hist.reduce((s, h) => s + h.count, 0);
  const sum = hist.reduce((s, h) => s + h.value * h.count, 0);
  const buckets = ["1", "2", "3", "4", "5", "6–9", "10+"];
  const bucketOf = (v: number) => (v >= 10 ? "10+" : v >= 6 ? "6–9" : String(v));
  const dist = new Map(buckets.map((b) => [b, 0]));
  for (const h of hist) if (h.value >= 1) dist.set(bucketOf(h.value), (dist.get(bucketOf(h.value)) ?? 0) + h.count);

  return {
    days,
    since: dayKey(start),
    generatedAt: opts.now.toISOString(),
    totalEvents: Number(rows.totalEvents),
    totalVisits: Number(rows.totalVisits),
    daily,
    funnel: stepsFor(totals),
    funnelBySource: refsRanked.slice(0, 8).map((r) => ({ ref: r.ref, steps: stepsFor(perSource.get(r.ref)) })),
    verdictsPerVisit: {
      visits: scanVisits,
      median: histMedian(hist),
      mean: scanVisits ? Math.round((sum / scanVisits) * 100) / 100 : 0,
      distribution: buckets.map((bucket) => ({ bucket, visits: dist.get(bucket) ?? 0 })),
    },
    topRefs: refsRanked.slice(0, 15),
    waitlist: { total: Number(rows.waitlistTotal), consenting: Number(rows.waitlistConsenting) },
    predictions: { total: Number(rows.predictionsTotal), resolved: Number(rows.predictionsResolved) },
  };
}
