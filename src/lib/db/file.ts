import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { finalizeStats, windowStart, dayKey, clampDays } from "@/lib/analytics/stats";
import {
  DIRECT_REF,
  EVENT_RETENTION_DAYS,
  FUNNEL_STEPS,
  PURGE_PROBABILITY,
  type AnalyticsEvent,
  type StatsRows,
} from "@/lib/analytics/types";
import type { Prediction, WaitlistSignup } from "@/lib/types";
import type { StorageAdapter } from "./adapter";
import {
  buildPrediction,
  formatPredictionId,
  normalizeEmail,
  normalizePredictionId,
  parsePredictionSeq,
} from "./normalize";

interface WaitlistFile {
  version: 1;
  signups: WaitlistSignup[];
}
interface EventsFile {
  version: 1;
  seq: number;
  events: Array<AnalyticsEvent & { id: number }>;
}
interface PredictionsFile {
  version: 1;
  seq: number;
  predictions: Prediction[];
}

/** Per-file in-process write queue: operations on the same path run strictly in order. */
const queues = new Map<string, Promise<unknown>>();
function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(file) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  queues.set(file, tail);
  void tail.then(() => {
    if (queues.get(file) === tail) queues.delete(file);
  });
  return run;
}

async function readJson<T>(file: string, fallback: () => T): Promise<T> {
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback();
    throw err;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // Never silently overwrite a corrupt store.
    throw new Error(`Storage file ${file} is not valid JSON; refusing to overwrite it.`);
  }
}

/** Atomic write: temp file in the same dir, fsync, then rename over the target. */
async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(JSON.stringify(data, null, 2) + "\n", "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

export interface AdapterOptions {
  /** Source of randomness for the opportunistic event purge (tests pass () => 0 to force it). */
  random?: () => number;
}

const DAY_MS = 86_400_000;

/** Aggregate in-memory events (file adapter) into the same rows the SQL adapter returns. */
export function eventsToStatsRows(events: AnalyticsEvent[], since: Date): Omit<StatsRows, "waitlistTotal" | "waitlistConsenting" | "predictionsTotal" | "predictionsResolved"> {
  const inWindow = events.filter((e) => Date.parse(e.at) >= since.getTime()).sort((a, b) => a.at.localeCompare(b.at));
  const counts = new Map<string, number>();
  const dayVisits = new Map<string, Set<string>>();
  const source = new Map<string, string>();
  const stepVisits = new Map<string, Set<string>>();
  const verdicts = new Map<string, number>();
  const visits = new Set<string>();
  for (const e of inWindow) {
    const day = dayKey(e.at);
    const k = `${day}\u0000${e.name}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    let dv = dayVisits.get(day);
    if (!dv) dayVisits.set(day, (dv = new Set()));
    dv.add(e.visitId);
    visits.add(e.visitId);
    if (e.name === "page_view" && typeof e.props.ref === "string" && !source.has(e.visitId)) source.set(e.visitId, e.props.ref);
    if ((FUNNEL_STEPS as readonly string[]).includes(e.name)) {
      let sv = stepVisits.get(e.name);
      if (!sv) stepVisits.set(e.name, (sv = new Set()));
      sv.add(e.visitId);
    }
    if (e.name === "verdict_shown") verdicts.set(e.visitId, (verdicts.get(e.visitId) ?? 0) + 1);
  }
  const sourceSteps = new Map<string, number>();
  for (const [name, set] of stepVisits) {
    for (const v of set) {
      const k = `${source.get(v) ?? DIRECT_REF}\u0000${name}`;
      sourceSteps.set(k, (sourceSteps.get(k) ?? 0) + 1);
    }
  }
  const hist = new Map<number, number>();
  for (const n of verdicts.values()) hist.set(n, (hist.get(n) ?? 0) + 1);
  return {
    dailyCounts: [...counts].map(([k, n]) => {
      const [day, name] = k.split("\u0000") as [string, string];
      return { day, name, n };
    }),
    dailyVisits: [...dayVisits].map(([day, set]) => ({ day, n: set.size })),
    sourceSteps: [...sourceSteps].map(([k, n]) => {
      const [ref, name] = k.split("\u0000") as [string, string];
      return { ref, name, n };
    }),
    verdictHist: [...hist].map(([verdicts, visits]) => ({ verdicts, visits })),
    totalEvents: inWindow.length,
    totalVisits: visits.size,
  };
}

export function createFileAdapter(
  dir: string,
  now: () => Date = () => new Date(),
  opts: AdapterOptions = {},
): StorageAdapter {
  const random = opts.random ?? Math.random;
  const waitlistFile = path.join(dir, "waitlist.json");
  const predictionsFile = path.join(dir, "predictions.json");
  const eventsFile = path.join(dir, "events.json");
  const emptyWaitlist = (): WaitlistFile => ({ version: 1, signups: [] });
  const emptyPredictions = (): PredictionsFile => ({ version: 1, seq: 0, predictions: [] });
  const emptyEvents = (): EventsFile => ({ version: 1, seq: 0, events: [] });

  const purge = (before: Date) =>
    withLock(eventsFile, async () => {
      const db = await readJson(eventsFile, emptyEvents);
      const n = db.events.length;
      db.events = db.events.filter((e) => Date.parse(e.at) >= before.getTime());
      if (db.events.length === n) return 0;
      await writeJsonAtomic(eventsFile, db);
      return n - db.events.length;
    });

  const readPredictions = () => readJson(predictionsFile, emptyPredictions);

  return {
    addWaitlist(s) {
      return withLock(waitlistFile, async () => {
        const db = await readJson(waitlistFile, emptyWaitlist);
        const email = normalizeEmail(s.email);
        if (db.signups.some((x) => x.email === email)) return { ok: true, duplicate: true };
        const entry: WaitlistSignup = {
          email,
          createdAt: s.createdAt || now().toISOString(),
          consentMarketing: s.consentMarketing === true,
        };
        if (s.source) entry.source = s.source;
        db.signups.push(entry);
        await writeJsonAtomic(waitlistFile, db);
        return { ok: true, duplicate: false };
      });
    },

    async waitlistCount() {
      const db = await readJson(waitlistFile, emptyWaitlist);
      return db.signups.length;
    },

    addPrediction(p) {
      return withLock(predictionsFile, async () => {
        const db = await readPredictions();
        const maxExisting = db.predictions.reduce((m, x) => Math.max(m, parsePredictionSeq(x.id)), 0);
        const seq = Math.max(db.seq, maxExisting) + 1;
        const pred = buildPrediction(p, formatPredictionId(seq), now().toISOString());
        db.seq = seq;
        db.predictions.push(pred);
        await writeJsonAtomic(predictionsFile, db);
        return pred;
      });
    },

    async listPredictions(opts) {
      const db = await readPredictions();
      const limit = Math.min(Math.max(Math.trunc(opts?.limit ?? 50), 1), 1000);
      return db.predictions
        .filter((p) => !opts?.publicOnly || p.isPublic)
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || parsePredictionSeq(b.id) - parsePredictionSeq(a.id),
        )
        .slice(0, limit);
    },

    async getPrediction(id) {
      const norm = normalizePredictionId(id);
      if (!norm) return null;
      const db = await readPredictions();
      return db.predictions.find((p) => p.id === norm) ?? null;
    },

    recordOutcome(id, outcome) {
      return withLock(predictionsFile, async () => {
        const norm = normalizePredictionId(id);
        if (!norm) return null;
        const db = await readPredictions();
        const pred = db.predictions.find((p) => p.id === norm);
        if (!pred) return null;
        pred.outcome = { grade: outcome.grade, reportedAt: now().toISOString() };
        if (outcome.certNumber) pred.outcome.certNumber = outcome.certNumber;
        await writeJsonAtomic(predictionsFile, db);
        return pred;
      });
    },

    deleteWaitlist(email) {
      return withLock(waitlistFile, async () => {
        const db = await readJson(waitlistFile, emptyWaitlist);
        const target = normalizeEmail(email);
        const before = db.signups.length;
        db.signups = db.signups.filter((x) => x.email !== target);
        if (db.signups.length === before) return false;
        await writeJsonAtomic(waitlistFile, db);
        return true;
      });
    },

    deletePrediction(id) {
      return withLock(predictionsFile, async () => {
        const norm = normalizePredictionId(id);
        if (!norm) return false;
        const db = await readPredictions();
        const before = db.predictions.length;
        // seq is kept, so a deleted id is never reused for a different prediction.
        db.predictions = db.predictions.filter((p) => p.id !== norm);
        if (db.predictions.length === before) return false;
        await writeJsonAtomic(predictionsFile, db);
        return true;
      });
    },

    async listWaitlist(o) {
      const db = await readJson(waitlistFile, emptyWaitlist);
      return db.signups
        .filter((x) => !o?.consentOnly || x.consentMarketing)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async recordEvent(e) {
      await withLock(eventsFile, async () => {
        const db = await readJson(eventsFile, emptyEvents);
        db.seq += 1;
        db.events.push({ id: db.seq, at: e.at || now().toISOString(), name: e.name, visitId: e.visitId, props: { ...e.props } });
        await writeJsonAtomic(eventsFile, db);
      });
      if (random() < PURGE_PROBABILITY) await purge(new Date(now().getTime() - EVENT_RETENTION_DAYS * DAY_MS));
    },

    purgeEvents(before) {
      return purge(before);
    },

    async getStats(o) {
      const days = clampDays(o?.days);
      const at = now();
      const [events, waitlist, predictions] = await Promise.all([
        readJson(eventsFile, emptyEvents),
        readJson(waitlistFile, emptyWaitlist),
        readPredictions(),
      ]);
      const rows: StatsRows = {
        ...eventsToStatsRows(events.events, windowStart(at, days)),
        waitlistTotal: waitlist.signups.length,
        waitlistConsenting: waitlist.signups.filter((x) => x.consentMarketing).length,
        predictionsTotal: predictions.predictions.length,
        predictionsResolved: predictions.predictions.filter((p) => p.outcome).length,
      };
      return finalizeStats(rows, { days, now: at });
    },
  };
}
