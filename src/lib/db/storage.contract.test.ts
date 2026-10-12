// The same behavioural contract, run against every storage adapter. The SQL adapter runs on
// PGlite (real Postgres compiled to WASM), so production SQL is exercised without a server.
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Prediction } from "@/lib/types";
import { createFileAdapter, createSqlAdapter, type SqlClient, type StorageAdapter } from "./index";

const base: Omit<Prediction, "id" | "createdAt"> = {
  card: { id: "sv3pt5-199", name: "Charizard ex", setId: "sv3pt5", setName: "151", number: "199" },
  grader: "PSA",
  tierId: "psa-standard",
  verdict: "SLEEVE",
  distribution: { 10: 0.2, 9: 0.6, 8: 0.2 },
  expectedProfitUsd: -23.18,
  intendsToSubmit: false,
  isPublic: true,
};

type Factory = (now: () => Date) => Promise<{ db: StorageAdapter; cleanup: () => Promise<void> }>;

const factories: Record<string, Factory> = {
  file: async (now) => {
    const dir = await mkdtemp(path.join(tmpdir(), "sos-contract-"));
    return { db: createFileAdapter(dir, now), cleanup: () => rm(dir, { recursive: true, force: true }) };
  },
  "sql (pglite)": async (now) => {
    const pg = new PGlite();
    const sql: SqlClient = {
      query: async <T,>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows,
    };
    return { db: createSqlAdapter(sql, now), cleanup: () => pg.close() };
  },
};

for (const [name, make] of Object.entries(factories)) {
  describe(`storage contract: ${name}`, () => {
    let db: StorageAdapter;
    let cleanup: () => Promise<void>;
    let t: number;
    beforeEach(async () => {
      t = Date.parse("2026-10-12T00:00:00Z");
      ({ db, cleanup } = await make(() => new Date((t += 1000))));
    });
    afterEach(() => cleanup());

    it("waitlist: normalizes, dedupes, counts, deletes", async () => {
      expect(await db.waitlistCount()).toBe(0);
      expect(await db.addWaitlist({ email: " Misty@Cerulean.Gym ", createdAt: "", consentMarketing: true })).toEqual({ ok: true, duplicate: false });
      expect(await db.addWaitlist({ email: "misty@cerulean.gym", createdAt: "", consentMarketing: false })).toEqual({ ok: true, duplicate: true });
      await db.addWaitlist({ email: "brock@pewter.gym", createdAt: "", consentMarketing: false });
      expect(await db.waitlistCount()).toBe(2);
      expect(await db.deleteWaitlist("MISTY@cerulean.gym")).toBe(true);
      expect(await db.deleteWaitlist("misty@cerulean.gym")).toBe(false);
      expect(await db.waitlistCount()).toBe(1);
    });

    it("predictions: sequential ids, newest first, public filter, sanitized", async () => {
      const a = await db.addPrediction(base);
      const b = await db.addPrediction({ ...base, isPublic: false });
      const c = await db.addPrediction({ ...base, card: { ...base.card, photo: "data:image/png;base64,AAA" } as never });
      expect([a.id, b.id, c.id]).toEqual(["R-0001", "R-0002", "R-0003"]);
      expect(a.createdAt).toBe("2026-10-12T00:00:01.000Z");
      expect((await db.listPredictions({ publicOnly: true })).map((p) => p.id)).toEqual(["R-0003", "R-0001"]);
      expect((await db.listPredictions()).length).toBe(3);
      expect((await db.listPredictions({ limit: 1 })).map((p) => p.id)).toEqual(["R-0003"]);
      expect(JSON.stringify(c)).not.toContain("data:image");
      expect(await db.getPrediction("r-1")).toEqual(a);
      expect(await db.getPrediction("R-9999")).toBeNull();
      expect(await db.getPrediction("not-an-id")).toBeNull();
    });

    it("concurrent inserts get unique ids", async () => {
      const preds = await Promise.all(Array.from({ length: 20 }, () => db.addPrediction(base)));
      expect(new Set(preds.map((p) => p.id)).size).toBe(20);
    });

    it("recordOutcome and deletePrediction", async () => {
      const p = await db.addPrediction(base);
      const out = await db.recordOutcome(p.id, { grade: 9, certNumber: "87654321", reportedAt: "ignored" });
      expect(out?.outcome).toEqual({ grade: 9, certNumber: "87654321", reportedAt: expect.stringMatching(/^2026-10-12T/) });
      expect((await db.getPrediction(p.id))?.outcome?.grade).toBe(9);
      expect(await db.recordOutcome("R-0404", { grade: 9, reportedAt: "" })).toBeNull();
      expect(await db.deletePrediction(p.id)).toBe(true);
      expect(await db.getPrediction(p.id)).toBeNull();
      expect(await db.deletePrediction(p.id)).toBe(false);
      // Deleted ids are never reused.
      expect((await db.addPrediction(base)).id).toBe("R-0002");
    });
  });
}
