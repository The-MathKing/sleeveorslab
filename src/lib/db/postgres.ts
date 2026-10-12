import postgres from "postgres";
import { clampDays, finalizeStats, windowStart } from "@/lib/analytics/stats";
import { DIRECT_REF, EVENT_RETENTION_DAYS, FUNNEL_STEPS, PURGE_PROBABILITY, type StatsRows } from "@/lib/analytics/types";
import type { Prediction, WaitlistSignup } from "@/lib/types";
import type { StorageAdapter } from "./adapter";
import type { AdapterOptions } from "./file";
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
  // Anonymous event counts (see /privacy). No IP, no user agent: just a per-tab random visit id.
  `CREATE TABLE IF NOT EXISTS events (
     id bigserial PRIMARY KEY,
     at timestamptz NOT NULL DEFAULT now(),
     name text NOT NULL,
     visit_id text NOT NULL,
     props jsonb NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS events_at_idx ON events (at)`,
  `CREATE INDEX IF NOT EXISTS events_name_at_idx ON events (name, at)`,
  `CREATE INDEX IF NOT EXISTS events_visit_at_idx ON events (visit_id, at)`,
];

// FUNNEL_STEPS are compile-time constants ([a-z_] only), safe to inline.
const FUNNEL_IN = FUNNEL_STEPS.map((s) => `'${s}'`).join(", ");
const DAY_SQL = `to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

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

export function createSqlAdapter(
  sql: SqlClient,
  now: () => Date = () => new Date(),
  opts: AdapterOptions = {},
): StorageAdapter {
  const random = opts.random ?? Math.random;
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

  const purge = async (before: Date) => {
    await ensureSchema();
    const rows = await sql.query(`DELETE FROM events WHERE at < $1 RETURNING id`, [before.toISOString()]);
    return rows.length;
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

    async listWaitlist(o) {
      await ensureSchema();
      const rows = await sql.query<{ email: string; created_at: Date | string; source: string | null; consent_marketing: boolean }>(
        `SELECT email, created_at, source, consent_marketing FROM waitlist
         WHERE ($1::boolean IS NOT TRUE OR consent_marketing)
         ORDER BY created_at DESC, email`,
        [o?.consentOnly === true],
      );
      return rows.map((r) => {
        const out: WaitlistSignup = {
          email: r.email,
          createdAt: new Date(r.created_at).toISOString(),
          consentMarketing: r.consent_marketing === true,
        };
        if (r.source) out.source = r.source;
        return out;
      });
    },

    async recordEvent(e) {
      await ensureSchema();
      await sql.query(`INSERT INTO events (at, name, visit_id, props) VALUES ($1, $2, $3, $4::jsonb)`, [
        e.at || now().toISOString(),
        e.name,
        e.visitId,
        JSON.stringify(e.props ?? {}),
      ]);
      if (random() < PURGE_PROBABILITY) await purge(new Date(now().getTime() - EVENT_RETENTION_DAYS * 86_400_000));
    },

    purgeEvents(before) {
      return purge(before);
    },

    async getStats(o) {
      await ensureSchema();
      const days = clampDays(o?.days);
      const at = now();
      const since = windowStart(at, days).toISOString();
      type N = string | number;
      const [dailyCounts, dailyVisits, sourceSteps, verdictHist, totals, waitlist, predictions] = await Promise.all([
        sql.query<{ day: string; name: string; n: N }>(
          `SELECT ${DAY_SQL} AS day, name, count(*) AS n FROM events WHERE at >= $1 GROUP BY 1, 2`,
          [since],
        ),
        sql.query<{ day: string; n: N }>(
          `SELECT ${DAY_SQL} AS day, count(DISTINCT visit_id) AS n FROM events WHERE at >= $1 GROUP BY 1`,
          [since],
        ),
        // Each visit's source is the ref on its first page_view that carried one.
        sql.query<{ ref: string; name: string; n: N }>(
          `WITH src AS (
             SELECT DISTINCT ON (visit_id) visit_id, props->>'ref' AS ref
             FROM events WHERE at >= $1 AND name = 'page_view' AND props->>'ref' IS NOT NULL
             ORDER BY visit_id, at, id
           )
           SELECT coalesce(src.ref, $2) AS ref, e.name, count(DISTINCT e.visit_id) AS n
           FROM events e LEFT JOIN src ON src.visit_id = e.visit_id
           WHERE e.at >= $1 AND e.name IN (${FUNNEL_IN})
           GROUP BY 1, 2`,
          [since, DIRECT_REF],
        ),
        sql.query<{ verdicts: N; visits: N }>(
          `SELECT n AS verdicts, count(*) AS visits FROM (
             SELECT visit_id, count(*) AS n FROM events WHERE at >= $1 AND name = 'verdict_shown' GROUP BY visit_id
           ) t GROUP BY n`,
          [since],
        ),
        sql.query<{ events: N; visits: N }>(
          `SELECT count(*) AS events, count(DISTINCT visit_id) AS visits FROM events WHERE at >= $1`,
          [since],
        ),
        sql.query<{ total: N; consenting: N }>(
          `SELECT count(*) AS total, count(*) FILTER (WHERE consent_marketing) AS consenting FROM waitlist`,
        ),
        sql.query<{ total: N; resolved: N }>(
          `SELECT count(*) AS total, count(outcome) AS resolved FROM predictions`,
        ),
      ]);
      const rows: StatsRows = {
        dailyCounts: dailyCounts.map((r) => ({ day: r.day, name: r.name, n: Number(r.n) })),
        dailyVisits: dailyVisits.map((r) => ({ day: r.day, n: Number(r.n) })),
        sourceSteps: sourceSteps.map((r) => ({ ref: r.ref, name: r.name, n: Number(r.n) })),
        verdictHist: verdictHist.map((r) => ({ verdicts: Number(r.verdicts), visits: Number(r.visits) })),
        totalEvents: Number(totals[0]?.events ?? 0),
        totalVisits: Number(totals[0]?.visits ?? 0),
        waitlistTotal: Number(waitlist[0]?.total ?? 0),
        waitlistConsenting: Number(waitlist[0]?.consenting ?? 0),
        predictionsTotal: Number(predictions[0]?.total ?? 0),
        predictionsResolved: Number(predictions[0]?.resolved ?? 0),
      };
      return finalizeStats(rows, { days, now: at });
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
