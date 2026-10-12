// Server-side storage. File-backed JSON in ./.data (or $DATA_DIR) by default;
// Postgres (stub, see ./postgres.ts) when DATABASE_URL is set.
import path from "node:path";
import type { Prediction, WaitlistSignup } from "@/lib/types";
import type { StorageAdapter } from "./adapter";
import { createFileAdapter } from "./file";
import { createPostgresAdapter } from "./postgres";

export type { StorageAdapter } from "./adapter";
export { createFileAdapter } from "./file";
export { normalizeEmail, normalizePredictionId } from "./normalize";

let adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  const url = process.env.DATABASE_URL;
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
