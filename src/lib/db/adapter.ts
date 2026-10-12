import type { AnalyticsEvent, AnalyticsStats } from "@/lib/analytics/types";
import type { Prediction, WaitlistSignup } from "@/lib/types";

export type RecordEventInput = Omit<AnalyticsEvent, "at"> & { at?: string };

export interface StorageAdapter {
  addWaitlist(s: WaitlistSignup): Promise<{ ok: boolean; duplicate: boolean }>;
  waitlistCount(): Promise<number>;
  addPrediction(p: Omit<Prediction, "id" | "createdAt">): Promise<Prediction>;
  listPredictions(opts?: { publicOnly?: boolean; limit?: number }): Promise<Prediction[]>;
  getPrediction(id: string): Promise<Prediction | null>;
  recordOutcome(id: string, outcome: NonNullable<Prediction["outcome"]>): Promise<Prediction | null>;
  /** Privacy deletion requests. Return true when something was removed. */
  deleteWaitlist(email: string): Promise<boolean>;
  deletePrediction(id: string): Promise<boolean>;
  /** Admin export. Newest first. */
  listWaitlist(opts?: { consentOnly?: boolean }): Promise<WaitlistSignup[]>;

  /** Anonymous, cookieless event counting. Opportunistically purges expired events (~1% of calls). */
  recordEvent(e: RecordEventInput): Promise<void>;
  /** Delete events older than `before`. Returns how many were removed. */
  purgeEvents(before: Date): Promise<number>;
  /** Aggregates over the last `days` UTC days (today included). */
  getStats(opts?: { days?: number }): Promise<AnalyticsStats>;
}
