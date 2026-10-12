// CONTRACT (owned by data agent). Server-side storage adapter. File-backed JSON in ./.data for
// dev/single-host; Postgres when DATABASE_URL is set.
import type { Prediction, WaitlistSignup } from "@/lib/types";
export declare function addWaitlist(s: WaitlistSignup): Promise<{ ok: boolean; duplicate: boolean }>;
export declare function waitlistCount(): Promise<number>;
export declare function addPrediction(p: Omit<Prediction, "id" | "createdAt">): Promise<Prediction>;
export declare function listPredictions(opts?: { publicOnly?: boolean; limit?: number }): Promise<Prediction[]>;
export declare function getPrediction(id: string): Promise<Prediction | null>;
export declare function recordOutcome(id: string, outcome: NonNullable<Prediction["outcome"]>): Promise<Prediction | null>;
