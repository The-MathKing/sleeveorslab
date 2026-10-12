import postgres from "postgres";
import type { Prediction, WaitlistSignup } from "@/lib/types";
import type { StorageAdapter } from "./adapter";
import { buildPrediction, formatPredictionId, normalizeEmail, normalizePredictionId, parsePredictionSeq } from "./normalize";

/**
 * Minimal SQL surface the adapter needs. Production wraps the `postgres` driver;
 * tests wrap PGlite (in-process Postgres), so the same SQL is exercised in both.
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS waitlist (
     email text PRIMARY KEY,
     created_at timestamptz NOT NULL,
     source text,
     consent_marketing boolean NOT NULL DEFAULT false
   )`,
  // Public id is derived from seq ("R-0042"); body holds the sanitized prediction.
  `CREATE TABLE IF NOT EXISTS predictions (
     seq bigserial PRIMARY KEY,
     created_at timestamptz NOT NULL DEFAULT now(),
     is_public boolean NOT NULL,
     body jsonb NOT NULL,
     outcome jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS predictions_public_created_idx ON predictions (is_public, created_at DESC, seq DESC)`,
];

interface PredictionRow {
  seq: string | number;
  created_at: Date | string;
  body: Omit<Prediction, "id" | "createdAt" | "outcome"> | string;
  outcome: Prediction["outcome"] | string | null;
}

function parseJson<T>(v: T | string): T {
  return typeof v === "string" ? (JSON.parse(v) as T) : v;
}

function rowToPrediction(r: PredictionRow): Prediction {
  const body = parseJson(r.body);
  const outcome = r.outcome == null ? undefined : parseJson(r.outcome);
  const pred: Prediction = {
    ...body,
    id: formatPredictionId(Number(r.seq)),
    createdAt: new Date(r.created_at).toISOString(),
  };
  if (outcome) pred.outcome = outcome;
  return pred;
}

export function createSqlAdapter(sql: SqlClient, now: () => Date = () => new Date()): StorageAdapter {
  let ready: Promise<void> | null = null;
  const ensureSchema = () => {
    ready ??= (async () => {
      for (const stmt of SCHEMA_SQL) await sql.query(stmt);
    })().catch((err) => {
      ready = null; // retry on the next call instead of caching a failure
      throw err;
    });
    return ready;
  };
  const seqOf = (id: string): number | null => {
    const norm = normalizePredictionId(id);
    return norm ? parsePredictionSeq(norm) : null;
  };

  return {
    async addWaitlist(s: WaitlistSignup) {
      await ensureSchema();
      const rows = await sql.query<{ email: string }>(
        `INSERT INTO waitlist (email, created_at, source, consent_marketing)
         VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING email`,
        [normalizeEmail(s.email), s.createdAt || now().toISOString(), s.source ?? null, s.consentMarketing === true],
      );
      return { ok: true, duplicate: rows.length === 0 };
    },

    async waitlistCount() {
      await ensureSchema();
      const [row] = await sql.query<{ n: string | number }>(`SELECT count(*) AS n FROM waitlist`);
      return Number(row?.n ?? 0);
    },

    async addPrediction(p) {
      await ensureSchema();
      const createdAt = now().toISOString();
      // buildPrediction sanitizes; id and createdAt live in their own columns.
      const body: Partial<Prediction> = buildPrediction(p, "R-0000", createdAt);
      delete body.id;
      delete body.createdAt;
      const [row] = await sql.query<PredictionRow>(
        `INSERT INTO predictions (created_at, is_public, body) VALUES ($1, $2, $3::jsonb)
         RETURNING seq, created_at, body, outcome`,
        [createdAt, p.isPublic, JSON.stringify(body)],
      );
      return rowToPrediction(row);
    },

    async listPredictions(opts) {
      await ensureSchema();
      const limit = Math.min(Math.max(Math.trunc(opts?.limit ?? 50), 1), 1000);
      const rows = await sql.query<PredictionRow>(
        `SELECT seq, created_at, body, outcome FROM predictions
         WHERE ($1::boolean IS NOT TRUE OR is_public)
         ORDER BY created_at DESC, seq DESC LIMIT $2`,
        [opts?.publicOnly === true, limit],
      );
      return rows.map(rowToPrediction);
    },

    async getPrediction(id) {
      const seq = seqOf(id);
      if (seq === null) return null;
      await ensureSchema();
      const [row] = await sql.query<PredictionRow>(
        `SELECT seq, created_at, body, outcome FROM predictions WHERE seq = $1`,
        [seq],
      );
      return row ? rowToPrediction(row) : null;
    },

    async recordOutcome(id, outcome) {
      const seq = seqOf(id);
      if (seq === null) return null;
      await ensureSchema();
      const stored: NonNullable<Prediction["outcome"]> = { grade: outcome.grade, reportedAt: now().toISOString() };
      if (outcome.certNumber) stored.certNumber = outcome.certNumber;
      const [row] = await sql.query<PredictionRow>(
        `UPDATE predictions SET outcome = $2::jsonb WHERE seq = $1 RETURNING seq, created_at, body, outcome`,
        [seq, JSON.stringify(stored)],
      );
      return row ? rowToPrediction(row) : null;
    },

    async deleteWaitlist(email) {
      await ensureSchema();
      const rows = await sql.query(`DELETE FROM waitlist WHERE email = $1 RETURNING email`, [normalizeEmail(email)]);
      return rows.length > 0;
    },

    async deletePrediction(id) {
      const seq = seqOf(id);
      if (seq === null) return false;
      await ensureSchema();
      const rows = await sql.query(`DELETE FROM predictions WHERE seq = $1 RETURNING seq`, [seq]);
      return rows.length > 0;
    },
  };
}

/** Selected when DATABASE_URL is set (Neon, Vercel Postgres, Supabase, or any Postgres). */
export function createPostgresAdapter(databaseUrl: string): StorageAdapter {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(databaseUrl);
  const client = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Poolers (Neon, Supabase, PgBouncer) don't support prepared statements.
    prepare: false,
    ssl: local ? false : "require",
  });
  const sql: SqlClient = {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await client.unsafe(text, params as postgres.ParameterOrJSON<never>[]);
      return rows as unknown as T[];
    },
  };
  return createSqlAdapter(sql);
}
