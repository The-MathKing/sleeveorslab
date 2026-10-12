import type { Prediction, WaitlistSignup } from "@/lib/types";

export interface StorageAdapter {
  addWaitlist(s: WaitlistSignup): Promise<{ ok: boolean; duplicate: boolean }>;
  waitlistCount(): Promise<number>;
  addPrediction(p: Omit<Prediction, "id" | "createdAt">): Promise<Prediction>;
  listPredictions(opts?: { publicOnly?: boolean; limit?: number }): Promise<Prediction[]>;
  getPrediction(id: string): Promise<Prediction | null>;
  recordOutcome(id: string, outcome: NonNullable<Prediction["outcome"]>): Promise<Prediction | null>;
}
