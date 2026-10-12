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

type Factory = (
  now: () => Date,
  random?: () => number,
) => Promise<{ db: StorageAdapter; cleanup: () => Promise<void> }>;

const factories: Record<string, Factory> = {
  file: async (now, random) => {
    const dir = await mkdtemp(path.join(tmpdir(), "sos-contract-"));
    return { db: createFileAdapter(dir, now, { random }), cleanup: () => rm(dir, { recursive: true, force: true }) };
  },
  "sql (pglite)": async (now, random) => {
    const pg = new PGlite();
    const sql: SqlClient = {
      query: async <T,>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows,
    };
    return { db: createSqlAdapter(sql, now, { random }), cleanup: () => pg.close() };
  },
};

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

for (const [name, make] of Object.entries(factories)) {
  describe(`storage contract: ${name}`, () => {
    let db: StorageAdapter;
    let cleanup: () => Promise<void>;
    let t: number;
    beforeEach(async () => {
      t = Date.parse("2026-10-12T00:00:00Z");
      // random() = 1 never triggers the opportunistic purge; the purge test builds its own adapter.
      ({ db, cleanup } = await make(() => new Date((t += 1000)), () => 1));
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

    it("listWaitlist: newest first, consent filter", async () => {
      await db.addWaitlist({ email: "a@x.io", createdAt: "2026-10-01T00:00:00.000Z", source: "landing", consentMarketing: true });
      await db.addWaitlist({ email: "b@x.io", createdAt: "2026-10-02T00:00:00.000Z", consentMarketing: false });
      expect((await db.listWaitlist()).map((w) => w.email)).toEqual(["b@x.io", "a@x.io"]);
      expect(await db.listWaitlist({ consentOnly: true })).toEqual([
        { email: "a@x.io", createdAt: "2026-10-01T00:00:00.000Z", source: "landing", consentMarketing: true },
      ]);
    });

    it("events: daily counts, visits, funnel by source, verdicts per visit", async () => {
      const today = Date.parse("2026-10-12T00:00:00Z");
      const yesterday = today - DAY;
      const ev = (visitId: string, name: string, at: number, props: Record<string, string | number> = {}) =>
        db.recordEvent({ visitId, name: name as never, at: iso(at), props });
      // Visit A (reddit): full funnel, 4 verdicts.
      await ev("visitAAAA", "page_view", yesterday + 1000, { path: "/", ref: "reddit.com" });
      await ev("visitAAAA", "page_view", yesterday + 2000, { path: "/scan" });
      await ev("visitAAAA", "scan_started", yesterday + 3000);
      await ev("visitAAAA", "centering_done", yesterday + 4000);
      for (let i = 0; i < 4; i++) await ev("visitAAAA", "verdict_shown", yesterday + 5000 + i, { verdict: "SLEEVE", grader: "PSA" });
      await ev("visitAAAA", "waitlist_signup", yesterday + 9000, { source: "after-first-verdict" });
      // Visit B (qr): 2 verdicts, today.
      await ev("visitBBBB", "page_view", today + 1000, { path: "/scan", ref: "qr" });
      await ev("visitBBBB", "scan_started", today + 2000);
      await ev("visitBBBB", "verdict_shown", today + 3000, { verdict: "SLAB", grader: "CGC" });
      await ev("visitBBBB", "verdict_shown", today + 4000, { verdict: "SLAB", grader: "CGC" });
      // Visit C (direct): bounced. Visit D (reddit): 1 verdict.
      await ev("visitCCCC", "page_view", today + 5000, { path: "/" });
      await ev("visitDDDD", "page_view", today + 6000, { path: "/", ref: "reddit.com" });
      await ev("visitDDDD", "scan_started", today + 6500);
      await ev("visitDDDD", "verdict_shown", today + 7000, { verdict: "BORDERLINE", grader: "PSA" });
      // Outside a 7-day window.
      await ev("visitOLDD", "page_view", today - 30 * DAY, { path: "/" });
      await db.addWaitlist({ email: "a@x.io", createdAt: "", consentMarketing: true });
      const p = await db.addPrediction(base);
      await db.addPrediction(base);
      await db.recordOutcome(p.id, { grade: 9, reportedAt: "" });

      const s = await db.getStats({ days: 7 });
      expect(s.days).toBe(7);
      expect(s.since).toBe("2026-10-06");
      expect(s.daily).toHaveLength(7);
      expect(s.daily.at(-1)).toMatchObject({ day: "2026-10-12", visits: 3, counts: { page_view: 3, verdict_shown: 3, scan_started: 2 } });
      expect(s.daily.at(-2)).toMatchObject({ day: "2026-10-11", visits: 1, counts: { page_view: 2, verdict_shown: 4, waitlist_signup: 1 } });
      expect(s.totalVisits).toBe(4);
      expect(s.totalEvents).toBe(17);
      expect(s.funnel).toEqual([
        { step: "page_view", visits: 4 },
        { step: "scan_started", visits: 3 },
        { step: "centering_done", visits: 1 },
        { step: "verdict_shown", visits: 3 },
        { step: "waitlist_signup", visits: 1 },
      ]);
      expect(s.topRefs).toEqual([
        { ref: "reddit.com", visits: 2 },
        { ref: "(direct)", visits: 1 },
        { ref: "qr", visits: 1 },
      ]);
      expect(s.funnelBySource[0]).toEqual({
        ref: "reddit.com",
        steps: [
          { step: "page_view", visits: 2 },
          { step: "scan_started", visits: 2 },
          { step: "centering_done", visits: 1 },
          { step: "verdict_shown", visits: 2 },
          { step: "waitlist_signup", visits: 1 },
        ],
      });
      // Verdicts per scanning visit: [4, 2, 1] → median 2.
      expect(s.verdictsPerVisit).toMatchObject({ visits: 3, median: 2, mean: 2.33 });
      expect(s.verdictsPerVisit.distribution.find((d) => d.bucket === "4")?.visits).toBe(1);
      expect(s.waitlist).toEqual({ total: 1, consenting: 1 });
      expect(s.predictions).toEqual({ total: 2, resolved: 1 });
      expect((await db.getStats({ days: 90 })).totalVisits).toBe(5);
    });

    it("events: purge removes only expired events", async () => {
      const now = Date.parse("2026-10-12T00:00:00Z");
      await db.recordEvent({ visitId: "visitOLDD", name: "page_view", at: iso(now - 91 * DAY), props: { path: "/" } });
      await db.recordEvent({ visitId: "visitNEWW", name: "page_view", at: iso(now - 1000), props: { path: "/" } });
      expect(await db.purgeEvents(new Date(now - 90 * DAY))).toBe(1);
      expect(await db.purgeEvents(new Date(now - 90 * DAY))).toBe(0);
      expect((await db.getStats({ days: 90 })).totalEvents).toBe(1);
    });

    it("events: recordEvent opportunistically purges past 90 days", async () => {
      const { db: always, cleanup: done } = await make(() => new Date("2026-10-12T00:00:00Z"), () => 0);
      try {
        await always.recordEvent({ visitId: "visitOLDD", name: "qr_shown", at: "2026-07-01T00:00:00.000Z", props: {} });
        await always.recordEvent({ visitId: "visitNEWW", name: "qr_shown", props: {} });
        expect(await always.purgeEvents(new Date("2026-01-01T00:00:00Z"))).toBe(0);
        const s = await always.getStats({ days: 90 });
        expect(s.totalEvents).toBe(1);
        expect(s.daily.at(-1)?.counts.qr_shown).toBe(1);
      } finally {
        await done();
      }
    });
  });
}
