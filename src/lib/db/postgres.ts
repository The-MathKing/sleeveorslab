import type { StorageAdapter } from "./adapter";

/**
 * ============================ POSTGRES ADAPTER (STUB) ============================
 * Selected when DATABASE_URL is set. The `pg` package is not installed yet, so every
 * method throws. To implement:
 *   1. npm install pg @types/pg
 *   2. Tables:
 *        waitlist(email text primary key, created_at timestamptz, source text, consent_marketing bool)
 *        predictions(seq bigserial primary key, id text unique, created_at timestamptz,
 *                    is_public bool, body jsonb)   -- id = 'R-' || lpad(seq::text, 4, '0')
 *   3. Implement each StorageAdapter method; keep email lowercased/trimmed and use
 *      ON CONFLICT (email) DO NOTHING to detect duplicates.
 * Until then, unset DATABASE_URL to use the file adapter in ./.data/.
 * ================================================================================
 */
export function createPostgresAdapter(_databaseUrl: string): StorageAdapter {
  const fail = (): never => {
    throw new Error(
      "DATABASE_URL is set but the Postgres adapter is not implemented (the `pg` package is not installed). " +
        "Unset DATABASE_URL to use file storage in ./.data, or implement src/lib/db/postgres.ts.",
    );
  };
  return {
    addWaitlist: async () => fail(),
    waitlistCount: async () => fail(),
    addPrediction: async () => fail(),
    listPredictions: async () => fail(),
    getPrediction: async () => fail(),
    recordOutcome: async () => fail(),
  };
}
