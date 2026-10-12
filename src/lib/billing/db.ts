// Picks the billing store from env: Postgres when DATABASE_URL/POSTGRES_URL is set (its own
// small pool, separate from src/lib/db), else ./.data/billing.json for local dev.
import path from "node:path";
import postgres from "postgres";
import { createFileBillingStore, createSqlBillingStore, type BillingSqlClient, type BillingStore } from "./store";

let store: BillingStore | null = null;

function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function createPostgresBillingStore(databaseUrl: string): BillingStore {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(databaseUrl);
  const client = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // poolers (Neon) don't support prepared statements
    ssl: local ? false : "require",
  });
  const sql: BillingSqlClient = {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await client.unsafe(text, params as postgres.ParameterOrJSON<never>[]);
      return rows as unknown as T[];
    },
  };
  return createSqlBillingStore(sql);
}

export function getBillingStore(): BillingStore {
  if (store) return store;
  const url = databaseUrl();
  store = url
    ? createPostgresBillingStore(url)
    : createFileBillingStore(process.env.DATA_DIR || path.join(process.cwd(), ".data"));
  return store;
}

/** For tests: swap the store (null resets to env-based selection). */
export function __setBillingStore(s: BillingStore | null): void {
  store = s;
}
