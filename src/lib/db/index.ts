// Server-side storage. Postgres when DATABASE_URL is set (required on serverless hosts
// like Vercel, whose filesystem is read-only); file-backed JSON in ./.data (or $DATA_DIR) otherwise.
import path from "node:path";
import type { AnalyticsStats } from "@/lib/analytics/types";
import type { Prediction, WaitlistSignup } from "@/lib/types";
import type { RecordEventInput, StorageAdapter } from "./adapter";
import { createFileAdapter } from "./file";
import { createPostgresAdapter } from "./postgres";

export type { RecordEventInput, StorageAdapter } from "./adapter";
export { createFileAdapter } from "./file";
export { createSqlAdapter, type SqlClient } from "./postgres";
export { normalizeEmail, normalizePredictionId } from "./normalize";

let adapter: StorageAdapter | null = null;

function databaseUrl(): string | undefined {
  // Vercel's Neon integration sets DATABASE_URL; older Vercel Postgres projects set POSTGRES_URL.
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function storageKind(): "postgres" | "file" {
  return databaseUrl() ? "postgres" : "file";
}

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  const url = databaseUrl();
  adapter = url
    ? createPostgresAdapter(url)
    : createFileAdapter(process.env.DATA_DIR || path.join(process.cwd(), ".data"));
  return adapter;
}

/** For tests: swap the adapter (pass null to reset to env-based selection). */
export function __setStorage(a: StorageAdapter | null): void {
  adapter = a;
}

export function addWaitlist(s: WaitlistSignup): Promise<{ ok: boolean; duplicate: boolean }> {
  return getStorage().addWaitlist(s);
}
export function waitlistCount(): Promise<number> {
  return getStorage().waitlistCount();
}
export function addPrediction(p: Omit<Prediction, "id" | "createdAt">): Promise<Prediction> {
  return getStorage().addPrediction(p);
}
export function listPredictions(opts?: { publicOnly?: boolean; limit?: number }): Promise<Prediction[]> {
  return getStorage().listPredictions(opts);
}
export function getPrediction(id: string): Promise<Prediction | null> {
  return getStorage().getPrediction(id);
}
export function recordOutcome(
  id: string,
  outcome: NonNullable<Prediction["outcome"]>,
): Promise<Prediction | null> {
  return getStorage().recordOutcome(id, outcome);
}
export function deleteWaitlist(email: string): Promise<boolean> {
  return getStorage().deleteWaitlist(email);
}
export function deletePrediction(id: string): Promise<boolean> {
  return getStorage().deletePrediction(id);
}
export function listWaitlist(opts?: { consentOnly?: boolean }): Promise<WaitlistSignup[]> {
  return getStorage().listWaitlist(opts);
}
export function recordEvent(e: RecordEventInput): Promise<void> {
  return getStorage().recordEvent(e);
}
export function getStats(opts?: { days?: number }): Promise<AnalyticsStats> {
  return getStorage().getStats(opts);
}
