// One behavioural contract for both billing stores. SQL runs on PGlite (real Postgres in WASM).
import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileBillingStore, createSqlBillingStore, type BillingSqlClient, type BillingStore } from "./store";

type Factory = (now: () => Date) => Promise<{ store: BillingStore; cleanup: () => Promise<void> }>;

export const billingStoreFactories: Record<string, Factory> = {
  file: async (now) => {
    const dir = await mkdtemp(path.join(tmpdir(), "sos-billing-"));
    return { store: createFileBillingStore(dir, now), cleanup: () => rm(dir, { recursive: true, force: true }) };
  },
  "sql (pglite)": async (now) => {
    const pg = new PGlite();
    const sql: BillingSqlClient = {
      query: async <T,>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows,
    };
    return { store: createSqlBillingStore(sql, now), cleanup: () => pg.close() };
  },
};

const DAY = 86_400_000;

for (const [name, make] of Object.entries(billingStoreFactories)) {
  describe(`billing store contract: ${name}`, () => {
    let store: BillingStore;
    let cleanup: () => Promise<void>;
    let t: number;
    beforeEach(async () => {
      t = Date.parse("2026-10-12T00:00:00Z");
      ({ store, cleanup } = await make(() => new Date((t += 1000))));
    });
    afterEach(() => cleanup());

    it("settings: safe defaults, partial patches, clearing", async () => {
      const s0 = await store.getSettings();
      expect(s0).toMatchObject({ paymentsEnabled: false, splitTest: false, priceIds: {}, secretKeyEnc: null });
      await store.updateSettings({ secretKeyEnc: "v1.x.y.z", secretKeyLast4: "abcd", secretKeyMode: "test" });
      await store.updateSettings({ priceIds: { "pro-monthly": "price_1", "pack-100": "price_2" }, splitTest: true });
      const s1 = await store.getSettings();
      expect(s1).toMatchObject({
        secretKeyEnc: "v1.x.y.z",
        secretKeyLast4: "abcd",
        secretKeyMode: "test",
        priceIds: { "pro-monthly": "price_1", "pack-100": "price_2" },
        splitTest: true,
        paymentsEnabled: false,
      });
      expect(s1.updatedAt).toMatch(/^2026-10-12T/);
      await store.updateSettings({ secretKeyEnc: null, paymentsEnabled: true });
      const s2 = await store.getSettings();
      expect(s2.secretKeyEnc).toBeNull();
      expect(s2.paymentsEnabled).toBe(true);
      expect(s2.secretKeyLast4).toBe("abcd");
    });

    it("customers: upsert keeps known email, lookups by email and subscription", async () => {
      await store.upsertCustomer({ id: "cus_1", email: " Misty@Cerulean.Gym ", livemode: false });
      const again = await store.upsertCustomer({ id: "cus_1", email: null });
      expect(again.email).toBe("misty@cerulean.gym");
      expect(again.credits).toBe(0);
      expect((await store.findCustomersByEmail("MISTY@cerulean.gym")).map((c) => c.id)).toEqual(["cus_1"]);
      expect(await store.findCustomersByEmail("brock@pewter.gym")).toEqual([]);
      expect(await store.getCustomer("cus_nope")).toBeNull();

      await store.setSubscription("cus_1", {
        subscriptionId: "sub_1",
        status: "active",
        currentPeriodEnd: "2026-11-12T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      const c = await store.findCustomerBySubscription("sub_1");
      expect(c).toMatchObject({ id: "cus_1", subscriptionStatus: "active", currentPeriodEnd: "2026-11-12T00:00:00.000Z", email: "misty@cerulean.gym" });
      // setSubscription on an unknown customer creates it
      await store.setSubscription("cus_2", { subscriptionId: "sub_2", status: "trialing", currentPeriodEnd: null, cancelAtPeriodEnd: true });
      expect(await store.getCustomer("cus_2")).toMatchObject({ subscriptionStatus: "trialing", cancelAtPeriodEnd: true, credits: 0 });
    });

    it("purchases: idempotent, credits granted exactly once", async () => {
      await store.upsertCustomer({ id: "cus_1", email: "a@b.co" });
      const p = { id: "cs_1", customerId: "cus_1", plan: "pack-100" as const, variant: null, amountCents: 1900, currency: "usd", credits: 100, livemode: false };
      expect(await store.recordPurchase(p)).toEqual({ inserted: true, credits: 100 });
      expect(await store.recordPurchase(p)).toEqual({ inserted: false, credits: 100 });
      expect(await store.recordPurchase({ ...p, id: "cs_2" })).toEqual({ inserted: true, credits: 200 });
      expect((await store.getCustomer("cus_1"))!.credits).toBe(200);
    });

    it("purchases: concurrent replays still grant once", async () => {
      await store.upsertCustomer({ id: "cus_1" });
      const p = { id: "cs_r", customerId: "cus_1", plan: "pack-100" as const, variant: null, amountCents: 1900, currency: "usd", credits: 100, livemode: false };
      const rs = await Promise.all([store.recordPurchase(p), store.recordPurchase(p), store.recordPurchase(p)]);
      expect(rs.filter((r) => r.inserted)).toHaveLength(1);
      expect((await store.getCustomer("cus_1"))!.credits).toBe(100);
    });

    it("credits: atomic consume, never negative", async () => {
      await store.upsertCustomer({ id: "cus_1" });
      await store.recordPurchase({ id: "cs_1", customerId: "cus_1", plan: "pack-100", variant: null, amountCents: 1900, currency: "usd", credits: 5, livemode: false });
      expect(await store.consumeCredits("cus_1", 3)).toEqual({ ok: true, creditsRemaining: 2 });
      expect(await store.consumeCredits("cus_1", 3)).toEqual({ ok: false, creditsRemaining: 2 });
      const rs = await Promise.all([store.consumeCredits("cus_1", 1), store.consumeCredits("cus_1", 1), store.consumeCredits("cus_1", 1)]);
      expect(rs.filter((r) => r.ok)).toHaveLength(2);
      expect((await store.getCustomer("cus_1"))!.credits).toBe(0);
      expect(await store.consumeCredits("cus_missing", 1)).toEqual({ ok: false, creditsRemaining: 0 });
    });

    it("events: first sighting only, forget allows retry", async () => {
      expect(await store.beginEvent("evt_1", "checkout.session.completed")).toBe(true);
      expect(await store.beginEvent("evt_1", "checkout.session.completed")).toBe(false);
      await store.forgetEvent("evt_1");
      expect(await store.beginEvent("evt_1", "checkout.session.completed")).toBe(true);
    });

    it("summary: active subs, packs, 30d revenue, per-variant conversions, mode filter", async () => {
      const start = t;
      await store.upsertCustomer({ id: "cus_a", livemode: true });
      await store.upsertCustomer({ id: "cus_b", livemode: true });
      await store.upsertCustomer({ id: "cus_t", livemode: false });
      await store.setSubscription("cus_a", { subscriptionId: "sub_a", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false });
      await store.setSubscription("cus_t", { subscriptionId: "sub_t", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false });
      const base = { currency: "usd", livemode: true };
      await store.recordPurchase({ ...base, id: "cs_old", customerId: "cus_b", plan: "pack-100", variant: "pack-first", amountCents: 1900, credits: 100, createdAt: new Date(start - 40 * DAY).toISOString() });
      await store.recordPurchase({ ...base, id: "cs_1", customerId: "cus_a", plan: "pro-monthly", variant: "monthly-first", amountCents: 699, credits: 0 });
      await store.recordPurchase({ ...base, id: "cs_2", customerId: "cus_b", plan: "pack-100", variant: "pack-first", amountCents: 1900, credits: 100 });
      await store.recordPurchase({ ...base, id: "cs_3", customerId: "cus_b", plan: "pack-100", variant: null, amountCents: 1500, credits: 100 });
      await store.recordPurchase({ id: "cs_t", customerId: "cus_t", plan: "pro-monthly", variant: null, amountCents: 699, credits: 0, currency: "usd", livemode: false });

      const live = await store.summary({ since: new Date(start - 30 * DAY), livemode: true });
      expect(live).toEqual({
        activeSubscriptions: 1,
        packsSoldAllTime: 3,
        packsSold30d: 2,
        subscriptionsStarted30d: 1,
        revenue30dCents: 699 + 1900 + 1500,
        creditsOutstanding: 300,
        byVariant: [
          { variant: "monthly-first", purchases: 1, pro: 1, pack: 0, revenueCents: 699 },
          { variant: "none", purchases: 1, pro: 0, pack: 1, revenueCents: 1500 },
          { variant: "pack-first", purchases: 1, pro: 0, pack: 1, revenueCents: 1900 },
        ],
      });
      const all = await store.summary({ since: new Date(start - 30 * DAY) });
      expect(all.activeSubscriptions).toBe(2);
      expect(all.revenue30dCents).toBe(699 * 2 + 1900 + 1500);
    });
  });
}
