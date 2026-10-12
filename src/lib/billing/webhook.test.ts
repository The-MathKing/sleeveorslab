// Webhook + claim logic driven by hand-built Stripe objects against a PGlite store. No network.
import { PGlite } from "@electric-sql/pglite";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { entitlementFor, fulfillCheckoutSession, processWebhookEvent, type BillingDeps } from "./logic";
import { createSqlBillingStore, type BillingSqlClient, type BillingStore } from "./store";
import { constructWebhookEvent, Stripe as StripeCtor } from "./stripe";

const T0 = Date.parse("2026-10-12T00:00:00Z") / 1000;

function session(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_pack1",
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    customer: "cus_pack",
    customer_details: { email: "Ash@Pallet.Town" },
    amount_total: 1900,
    currency: "usd",
    livemode: false,
    created: T0,
    metadata: { app: "sleeveorslab", plan: "pack-100", variant: "pack-first" },
    subscription: null,
    ...over,
  } as unknown as Stripe.Checkout.Session;
}

function sub(over: Partial<Stripe.Subscription> & { periodEnd?: number } = {}): Stripe.Subscription {
  const { periodEnd = T0 + 30 * 86_400, ...rest } = over;
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_pro",
    status: "active",
    cancel_at_period_end: false,
    metadata: { app: "sleeveorslab", plan: "pro-monthly" },
    items: { object: "list", data: [{ id: "si_1", current_period_end: periodEnd }] },
    ...rest,
  } as unknown as Stripe.Subscription;
}

let n = 0;
function event<T>(type: string, object: T): Stripe.Event {
  return { id: `evt_${++n}`, object: "event", type, data: { object }, livemode: false, created: T0 } as unknown as Stripe.Event;
}

describe("webhook + claim logic", () => {
  let pg: PGlite;
  let store: BillingStore;
  let deps: BillingDeps;

  beforeEach(() => {
    pg = new PGlite();
    const sql: BillingSqlClient = { query: async <T,>(q: string, p?: unknown[]) => (await pg.query<T>(q, p)).rows };
    store = createSqlBillingStore(sql);
    deps = { store };
  });
  afterEach(() => pg.close());

  it("pack checkout grants 100 credits once, even if claim and webhook both run", async () => {
    const s = session();
    expect(await fulfillCheckoutSession(s, deps)).toMatchObject({ ok: true, customerId: "cus_pack", plan: "pack-100", inserted: true });
    const ev = event("checkout.session.completed", s);
    expect(await processWebhookEvent(ev, deps)).toMatchObject({ duplicate: false, handled: true, detail: "already-fulfilled" });
    expect(await processWebhookEvent(ev, deps)).toMatchObject({ duplicate: true });
    const c = await store.getCustomer("cus_pack");
    expect(c).toMatchObject({ credits: 100, email: "ash@pallet.town" });
    expect(entitlementFor(c)).toMatchObject({ plan: "pack-100", status: "credits", isPro: false, creditsRemaining: 100 });
    const sum = await store.summary({ since: new Date(0) });
    expect(sum.byVariant).toEqual([{ variant: "pack-first", purchases: 1, pro: 0, pack: 1, revenueCents: 1900 }]);
  });

  it("ignores unpaid sessions and sessions from other products", async () => {
    expect(await fulfillCheckoutSession(session({ payment_status: "unpaid" }), deps)).toEqual({ ok: false, reason: "not-paid" });
    expect(await fulfillCheckoutSession(session({ status: "open" }), deps)).toEqual({ ok: false, reason: "not-paid" });
    expect(await fulfillCheckoutSession(session({ metadata: { plan: "pack-100" } }), deps)).toEqual({ ok: false, reason: "not-ours" });
    expect(await store.getCustomer("cus_pack")).toBeNull();
  });

  it("subscription checkout → Pro, with period end from an expanded subscription", async () => {
    const s = session({
      id: "cs_test_pro1",
      mode: "subscription",
      customer: "cus_pro",
      amount_total: 699,
      metadata: { app: "sleeveorslab", plan: "pro-monthly", variant: "monthly-first" },
      subscription: sub(),
    });
    await processWebhookEvent(event("checkout.session.completed", s), deps);
    const e = entitlementFor(await store.getCustomer("cus_pro"));
    expect(e).toMatchObject({ plan: "pro-monthly", status: "active", isPro: true, renewsAt: new Date((T0 + 30 * 86_400) * 1000).toISOString(), endsAt: null });
  });

  it("subscription checkout without expansion falls back to active, then updates fill in", async () => {
    const s = session({ id: "cs_test_pro2", mode: "subscription", customer: "cus_pro", metadata: { app: "sleeveorslab", plan: "pro-monthly" }, subscription: "sub_1" as never });
    await processWebhookEvent(event("checkout.session.completed", s), deps);
    expect(await store.getCustomer("cus_pro")).toMatchObject({ subscriptionId: "sub_1", subscriptionStatus: "active", currentPeriodEnd: null });

    // Renewal: period moves forward. Cancel at period end: still Pro, shows end date.
    await processWebhookEvent(event("customer.subscription.updated", sub({ cancel_at_period_end: true, periodEnd: T0 + 60 * 86_400 })), deps);
    const e = entitlementFor(await store.getCustomer("cus_pro"));
    expect(e).toMatchObject({ isPro: true, renewsAt: null, endsAt: new Date((T0 + 60 * 86_400) * 1000).toISOString() });

    await processWebhookEvent(event("customer.subscription.deleted", sub({ status: "canceled" })), deps);
    expect(entitlementFor(await store.getCustomer("cus_pro"))).toMatchObject({ plan: "free", isPro: false, status: "canceled" });
  });

  it("invoice.payment_failed marks past_due (access kept while Stripe retries)", async () => {
    await processWebhookEvent(event("customer.subscription.updated", sub()), deps);
    const inv = { id: "in_1", object: "invoice", parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } } };
    expect(await processWebhookEvent(event("invoice.payment_failed", inv), deps)).toMatchObject({ handled: true, detail: "past_due" });
    expect(entitlementFor(await store.getCustomer("cus_pro"))).toMatchObject({ isPro: true, status: "past_due" });
    // Then Stripe gives up:
    await processWebhookEvent(event("customer.subscription.updated", sub({ status: "unpaid" })), deps);
    expect(entitlementFor(await store.getCustomer("cus_pro")).isPro).toBe(false);
  });

  it("prefers a fresh subscription from Stripe over a stale event payload", async () => {
    deps.retrieveSubscription = async () => sub({ status: "canceled" });
    await processWebhookEvent(event("customer.subscription.updated", sub({ status: "active" })), deps);
    expect((await store.getCustomer("cus_pro"))!.subscriptionStatus).toBe("canceled");
  });

  it("a late event for an old subscription doesn't clobber the current one", async () => {
    await processWebhookEvent(event("customer.subscription.updated", sub({ id: "sub_new" })), deps);
    const r = await processWebhookEvent(event("customer.subscription.deleted", sub({ id: "sub_old", status: "canceled" })), deps);
    expect(r.detail).toBe("ignored-stale");
    expect(await store.getCustomer("cus_pro")).toMatchObject({ subscriptionId: "sub_new", subscriptionStatus: "active" });
  });

  it("ignores subscriptions for unknown customers from other products, and unknown event types", async () => {
    const r = await processWebhookEvent(event("customer.subscription.updated", sub({ customer: "cus_other", metadata: {} })), deps);
    expect(r).toMatchObject({ handled: false, detail: "ignored-foreign" });
    expect(await processWebhookEvent(event("charge.refunded", { id: "ch_1" }), deps)).toMatchObject({ handled: false, detail: "ignored" });
  });

  it("releases the event id when the handler throws, so Stripe's retry is processed", async () => {
    const broken: BillingDeps = { store: { ...store, upsertCustomer: async () => { throw new Error("db down"); } } };
    const ev = event("checkout.session.completed", session());
    await expect(processWebhookEvent(ev, broken)).rejects.toThrow("db down");
    expect(await processWebhookEvent(ev, deps)).toMatchObject({ duplicate: false, handled: true });
    expect((await store.getCustomer("cus_pack"))!.credits).toBe(100);
  });

  it("signature verification accepts the right secret and rejects tampering", () => {
    const secret = "whsec_test_secret_value";
    const payload = JSON.stringify(event("checkout.session.completed", session()));
    const header = StripeCtor.webhooks.generateTestHeaderString({ payload, secret });
    expect(constructWebhookEvent(payload, header, secret).type).toBe("checkout.session.completed");
    expect(() => constructWebhookEvent(payload, header, "whsec_wrong")).toThrow();
    expect(() => constructWebhookEvent(payload.replace("1900", "1"), header, secret)).toThrow();
  });
});
