import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
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

export function createFileAdapter(dir: string, now: () => Date = () => new Date()): StorageAdapter {
  const waitlistFile = path.join(dir, "waitlist.json");
  const predictionsFile = path.join(dir, "predictions.json");
  const emptyWaitlist = (): WaitlistFile => ({ version: 1, signups: [] });
  const emptyPredictions = (): PredictionsFile => ({ version: 1, seq: 0, predictions: [] });

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
  };
}
