import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Prediction } from "@/lib/types";
import { createFileAdapter, normalizePredictionId, type StorageAdapter } from "./index";

const base: Omit<Prediction, "id" | "createdAt"> = {
  card: { id: "sv3pt5-199", name: "Charizard ex", setId: "sv3pt5", setName: "151", number: "199" },
  grader: "PSA",
  tierId: "psa-value",
  verdict: "SLAB",
  distribution: { 10: 0.4, 9: 0.5, 8: 0.1 },
  expectedProfitUsd: 42,
  intendsToSubmit: true,
  isPublic: true,
};

describe("file adapter", () => {
  let dir: string;
  let db: StorageAdapter;
  let t: number;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "sos-db-"));
    t = Date.parse("2026-01-01T00:00:00Z");
    db = createFileAdapter(dir, () => new Date((t += 1000)));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("waitlist: lowercases, trims, dedupes, counts", async () => {
    expect(await db.waitlistCount()).toBe(0);
    expect(await db.addWaitlist({ email: "  Ash@Pallet.Town ", createdAt: "", consentMarketing: true })).toEqual({ ok: true, duplicate: false });
    expect(await db.addWaitlist({ email: "ash@pallet.town", createdAt: "", consentMarketing: false })).toEqual({ ok: true, duplicate: true });
    expect(await db.waitlistCount()).toBe(1);
    const file = JSON.parse(await readFile(path.join(dir, "waitlist.json"), "utf8"));
    expect(file.signups[0].email).toBe("ash@pallet.town");
  });

  it("concurrent writes are serialized with sequential ids and no temp files left", async () => {
    const preds = await Promise.all(Array.from({ length: 25 }, () => db.addPrediction(base)));
    expect(new Set(preds.map((p) => p.id)).size).toBe(25);
    expect(preds.map((p) => p.id).sort()[0]).toBe("R-0001");
    expect((await db.listPredictions({ limit: 100 })).length).toBe(25);
    expect((await readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    await Promise.all(Array.from({ length: 10 }, (_, i) => db.addWaitlist({ email: `u${i}@x.io`, createdAt: "", consentMarketing: false })));
    expect(await db.waitlistCount()).toBe(10);
  });

  it("lists newest first, filters public, strips unknown fields", async () => {
    const a = await db.addPrediction(base);
    await db.addPrediction({ ...base, isPublic: false });
    const c = await db.addPrediction({ ...base, card: { ...base.card, frontPhoto: "data:image/png;base64,AAA" } as never, imageSmall: "x" } as never);
    const list = await db.listPredictions({ publicOnly: true });
    expect(list.map((p) => p.id)).toEqual([c.id, a.id]);
    expect(JSON.stringify(c)).not.toContain("data:image");
    expect(c).not.toHaveProperty("imageSmall");
    expect(await db.getPrediction("r-1")).toEqual(a);
    expect(await db.getPrediction("R-9999")).toBeNull();
  });

  it("recordOutcome sets reportedAt", async () => {
    const p = await db.addPrediction(base);
    const out = await db.recordOutcome(p.id, { grade: 10, certNumber: "12345678", reportedAt: "ignored" });
    expect(out?.outcome?.grade).toBe(10);
    expect(out?.outcome?.certNumber).toBe("12345678");
    expect(out?.outcome?.reportedAt).toMatch(/^2026-01-01T/);
    expect((await db.getPrediction(p.id))?.outcome?.grade).toBe(10);
    expect(await db.recordOutcome("R-0404", { grade: 9, reportedAt: "" })).toBeNull();
  });
});

describe("misc", () => {
  it("normalizes ids", () => {
    expect(normalizePredictionId("r-42")).toBe("R-0042");
    expect(normalizePredictionId("R-12345")).toBe("R-12345");
    expect(normalizePredictionId("../x")).toBeNull();
  });
});
