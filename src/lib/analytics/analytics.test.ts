import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { __setStorage, createFileAdapter, type StorageAdapter } from "@/lib/db";
import { POST } from "@/app/api/events/route";
import { eventSchema } from "./schema";
import { histMedian, windowStart } from "./stats";

describe("event schema (closed allowlist)", () => {
  const v = "abcdef123456";
  it("accepts known events with allowed props", () => {
    expect(eventSchema.safeParse({ name: "page_view", visitId: v, props: { path: "/scan", ref: "reddit.com" } }).success).toBe(true);
    expect(eventSchema.safeParse({ name: "scan_started", visitId: v }).success).toBe(true);
    expect(eventSchema.safeParse({ name: "photo_captured", visitId: v, props: { method: "sample" } }).success).toBe(true);
    expect(eventSchema.safeParse({ name: "verdict_shown", visitId: v, props: { verdict: "SLAB", grader: "PSA" } }).success).toBe(true);
    expect(eventSchema.safeParse({ name: "binder_evaluated", visitId: v, props: { cards: 12 } }).success).toBe(true);
    expect(eventSchema.safeParse({ name: "waitlist_signup", visitId: v, props: { source: "after-first-verdict" } }).success).toBe(true);
  });
  it("rejects unknown events, extra props, free text, and identifiers", () => {
    expect(eventSchema.safeParse({ name: "clicked_ad", visitId: v }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "card_selected", visitId: v, props: { cardId: "sv3pt5-199" } }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "waitlist_signup", visitId: v, props: { source: "ash@pallet.town" } }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "page_view", visitId: v, props: { path: "/scan?email=a@b.co" } }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "photo_captured", visitId: v, props: { method: "x-ray" } }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "binder_evaluated", visitId: v, props: { cards: 1.5 } }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "scan_started", visitId: "short" }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "scan_started", visitId: v, ip: "1.2.3.4" }).success).toBe(false);
  });
});

describe("stats helpers", () => {
  it("histMedian", () => {
    expect(histMedian([])).toBe(0);
    expect(histMedian([{ value: 3, count: 1 }])).toBe(3);
    expect(histMedian([{ value: 1, count: 2 }, { value: 4, count: 2 }])).toBe(2.5);
    expect(histMedian([{ value: 5, count: 1 }, { value: 1, count: 3 }])).toBe(1);
  });
  it("windowStart includes today", () => {
    expect(windowStart(new Date("2026-10-12T15:00:00Z"), 1).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(windowStart(new Date("2026-10-12T15:00:00Z"), 7).toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});

describe("POST /api/events", () => {
  let dir: string;
  let db: StorageAdapter;
  let ip = 0;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "sos-events-"));
    db = createFileAdapter(dir, undefined, { random: () => 1 });
    __setStorage(db);
  });
  afterEach(async () => {
    __setStorage(null);
    await rm(dir, { recursive: true, force: true });
  });
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}`, "user-agent": "UA/1.0", ...headers },
      body,
    });

  it("stores a valid event with no IP or user agent and returns 204", async () => {
    const res = await POST(req(JSON.stringify({ name: "verdict_shown", visitId: "abcdef123456", props: { verdict: "SLEEVE", grader: "CGC" } })));
    expect(res.status).toBe(204);
    const s = await db.getStats({ days: 1 });
    expect(s.totalEvents).toBe(1);
    const raw = await readFile(path.join(dir, "events.json"), "utf8");
    expect(raw).not.toContain("10.0.0.");
    expect(raw).not.toContain("UA/1.0");
  });

  it("rejects invalid and oversized bodies", async () => {
    expect((await POST(req(JSON.stringify({ name: "nope", visitId: "abcdef123456" })))).status).toBe(400);
    expect((await POST(req("not json"))).status).toBe(400);
    const big = JSON.stringify({ name: "scan_started", visitId: "abcdef123456", pad: "x".repeat(5000) });
    expect((await POST(req(big))).status).toBe(413);
  });

  it("honors DNT / GPC headers by storing nothing", async () => {
    const body = JSON.stringify({ name: "scan_started", visitId: "abcdef123456" });
    expect((await POST(req(body, { dnt: "1" }))).status).toBe(204);
    expect((await POST(req(body, { "sec-gpc": "1" }))).status).toBe(204);
    expect((await db.getStats({ days: 1 })).totalEvents).toBe(0);
  });
});
