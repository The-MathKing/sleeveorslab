// Route-level smoke tests with a file-backed store and no Stripe key: everything must degrade
// gracefully (payments read as off) while entitlement endpoints keep working.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { envKey, issueEntitlementToken, issueRestoreToken } from "@/lib/billing/crypto";
import { __setBillingStore } from "@/lib/billing/db";
import { createFileBillingStore, type BillingStore } from "@/lib/billing/store";
import { GET as configGET } from "./config/route";
import { POST as checkoutPOST } from "./checkout/route";
import { POST as consumePOST } from "./consume/route";
import { GET as meGET } from "./me/route";
import { GET as restoreGET, POST as restorePOST } from "./restore/route";
import { POST as portalPOST } from "./portal/route";
import { POST as webhookPOST } from "../stripe/webhook/route";
import { GET as settingsGET, POST as settingsPOST } from "../admin/billing/settings/route";

let dir: string;
let store: BillingStore;
const ADMIN = "test-admin-token-123";
let ip = 0;

function req(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  // Unique IP per request so the in-memory rate limiter never interferes.
  return new Request(`http://localhost${url}`, { ...init, headers: { "x-forwarded-for": `10.0.0.${++ip % 250}`, ...init.headers } });
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "sos-billing-routes-"));
  process.env.ADMIN_TOKEN = ADMIN;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.RESEND_API_KEY;
  store = createFileBillingStore(dir);
  __setBillingStore(store);
  await store.upsertCustomer({ id: "cus_pack", email: "ash@pallet.town" });
  await store.recordPurchase({ id: "cs_1", customerId: "cus_pack", plan: "pack-100", variant: null, amountCents: 1900, currency: "usd", credits: 2, livemode: false });
});

afterAll(async () => {
  __setBillingStore(null);
  await rm(dir, { recursive: true, force: true });
});

const bearer = (cid: string) => ({ authorization: `Bearer ${issueEntitlementToken(cid, envKey("entitlement"))}` });

describe("billing routes without Stripe configured", () => {
  it("config says payments are off but lists plans", async () => {
    const j = await (await configGET(req("/api/billing/config"))).json();
    expect(j.enabled).toBe(false);
    expect(j.plans.map((p: { id: string }) => p.id)).toEqual(["free", "pro-monthly", "pack-100"]);
  });

  it("checkout is 409 while payments are off, 400 on bad input", async () => {
    const ok = await checkoutPOST(req("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "pack-100" }) }));
    expect(ok.status).toBe(409);
    const bad = await checkoutPOST(req("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "gold" }) }));
    expect(bad.status).toBe(400);
  });

  it("me + consume work from the DB alone", async () => {
    expect((await meGET(req("/api/billing/me"))).status).toBe(401);
    expect((await meGET(req("/api/billing/me", { headers: { authorization: "Bearer junk.token" } }))).status).toBe(401);
    const me = await (await meGET(req("/api/billing/me", { headers: bearer("cus_pack") }))).json();
    expect(me).toMatchObject({ plan: "pack-100", creditsRemaining: 2, isPro: false });

    const c1 = await consumePOST(req("/api/billing/consume", { method: "POST", headers: bearer("cus_pack"), body: JSON.stringify({ count: 2 }) }));
    expect(await c1.json()).toEqual({ ok: true, creditsRemaining: 0, unlimited: false });
    const c2 = await consumePOST(req("/api/billing/consume", { method: "POST", headers: bearer("cus_pack"), body: JSON.stringify({ count: 1 }) }));
    expect(c2.status).toBe(402);
    const c3 = await consumePOST(req("/api/billing/consume", { method: "POST", headers: bearer("cus_pack"), body: JSON.stringify({ count: 0 }) }));
    expect(c3.status).toBe(400);
  });

  it("portal degrades with a human fallback", async () => {
    const r = await portalPOST(req("/api/billing/portal", { method: "POST", headers: bearer("cus_pack") }));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("hello@sleeveorslab.com");
  });

  it("restore without Resend points to the support email; exchange works", async () => {
    const r = await restorePOST(req("/api/billing/restore", { method: "POST", body: JSON.stringify({ email: "nobody@example.com" }) }));
    expect(await r.json()).toMatchObject({ ok: true, emailed: false });
    const t = issueRestoreToken("ash@pallet.town", envKey("restore"));
    const x = await restoreGET(req(`/api/billing/restore?t=${encodeURIComponent(t)}`));
    const j = await x.json();
    expect(x.status).toBe(200);
    expect(typeof j.token).toBe("string");
    const forged = issueRestoreToken("ash@pallet.town", envKey("entitlement"));
    expect((await restoreGET(req(`/api/billing/restore?t=${encodeURIComponent(forged)}`))).status).toBe(400);
  });

  it("webhook refuses unsigned or unconfigured requests", async () => {
    expect((await webhookPOST(req("/api/stripe/webhook", { method: "POST", body: "{}" }))).status).toBe(400);
    expect((await webhookPOST(req("/api/stripe/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=x" } }))).status).toBe(503);
  });

  it("admin settings: auth, masking, and enable guard", async () => {
    expect((await settingsGET(req("/api/admin/billing/settings"))).status).toBe(401);
    const h = { "x-admin-token": ADMIN };
    const save = await settingsPOST(
      req("/api/admin/billing/settings", { method: "POST", headers: h, body: JSON.stringify({ secretKey: "sk_test_abcdefghijklmnop1234", webhookSecret: "whsec_abcdefghijklmnopWXYZ" }) }),
    );
    const body = await save.text();
    expect(save.status).toBe(200);
    expect(body).not.toContain("abcdefghijklmnop");
    expect(JSON.parse(body).settings.secretKey).toMatchObject({ configured: true, last4: "1234", mode: "test", source: "admin" });
    const raw = JSON.stringify(await store.getSettings());
    expect(raw).not.toContain("sk_test_");

    const enable = await settingsPOST(req("/api/admin/billing/settings", { method: "POST", headers: h, body: JSON.stringify({ paymentsEnabled: true }) }));
    expect(enable.status).toBe(409); // prices not created yet
    const bad = await settingsPOST(req("/api/admin/billing/settings", { method: "POST", headers: h, body: JSON.stringify({ secretKey: "pk_live_nope" }) }));
    expect(bad.status).toBe(400);
  });
});
