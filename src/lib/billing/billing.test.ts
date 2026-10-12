import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  deriveKey,
  encryptSecret,
  envKey,
  issueEntitlementToken,
  issueRestoreToken,
  keyMode,
  RESTORE_TTL_MS,
  rootSecret,
  signToken,
  verifyToken,
} from "./crypto";
import { adminView, publicView, resolveFromSettings } from "./config";
import { buildCheckoutParams } from "./logic";
import { featuredPlan, orderedPaidPlans, PLANS, publicPlans } from "./plans";
import { DEFAULT_SETTINGS } from "./store";

describe("plans", () => {
  it("has the three plans with the agreed prices and lookup keys", () => {
    expect(Object.keys(PLANS)).toEqual(["free", "pro-monthly", "pack-100"]);
    expect(PLANS["pro-monthly"]).toMatchObject({ priceCents: 699, price: "$6.99", billing: "subscription", lookupKey: "sos_pro_monthly" });
    expect(PLANS["pack-100"]).toMatchObject({ priceCents: 1900, price: "$19", billing: "one-time", credits: 100, lookupKey: "sos_pack_100" });
    expect(PLANS.free.priceCents).toBe(0);
  });
  it("display price matches cents", () => {
    for (const p of Object.values(PLANS)) {
      const cents = Math.round(Number(p.price.replace("$", "")) * 100);
      expect(cents).toBe(p.priceCents);
    }
  });
  it("orders and features by pricing-test arm", () => {
    expect(orderedPaidPlans("monthly-first").map((p) => p.id)).toEqual(["pro-monthly", "pack-100"]);
    expect(orderedPaidPlans("pack-first").map((p) => p.id)).toEqual(["pack-100", "pro-monthly"]);
    expect(orderedPaidPlans(null).map((p) => p.id)).toEqual(["pro-monthly", "pack-100"]);
    expect(featuredPlan("pack-first")).toBe("pack-100");
    expect(featuredPlan(null)).toBe("pro-monthly");
  });
  it("public plans carry no Stripe identifiers", () => {
    expect(JSON.stringify(publicPlans())).not.toMatch(/lookupKey|productName|sos_/);
  });
});

describe("crypto", () => {
  const key = deriveKey("root-secret", "encryption");

  it("derives distinct keys per purpose and root", () => {
    expect(deriveKey("root-secret", "encryption").equals(key)).toBe(true);
    expect(deriveKey("root-secret", "entitlement").equals(key)).toBe(false);
    expect(deriveKey("other-root", "encryption").equals(key)).toBe(false);
  });

  it("round-trips secrets with AES-256-GCM and random IVs", () => {
    const a = encryptSecret("sk_test_abc123456789", key);
    const b = encryptSecret("sk_test_abc123456789", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("sk_test");
    expect(decryptSecret(a, key)).toBe("sk_test_abc123456789");
  });

  it("refuses tampered, malformed, or wrong-key ciphertext", () => {
    const blob = encryptSecret("whsec_abcdefghijkl", key);
    const parts = blob.split(".");
    const ct = Buffer.from(parts[2]!, "base64url");
    ct[0] = ct[0]! ^ 1;
    expect(decryptSecret([parts[0], parts[1], ct.toString("base64url"), parts[3]].join("."), key)).toBeNull();
    expect(decryptSecret(blob, deriveKey("other-root", "encryption"))).toBeNull();
    expect(decryptSecret("garbage", key)).toBeNull();
    expect(decryptSecret("v2." + parts.slice(1).join("."), key)).toBeNull();
  });

  it("prefers BILLING_ENCRYPTION_KEY over ADMIN_TOKEN", () => {
    expect(rootSecret({ ADMIN_TOKEN: "a" } as unknown as NodeJS.ProcessEnv)).toBe("a");
    expect(rootSecret({ ADMIN_TOKEN: "a", BILLING_ENCRYPTION_KEY: "b" } as unknown as NodeJS.ProcessEnv)).toBe("b");
    expect(rootSecret({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(() => envKey("entitlement", {} as unknown as NodeJS.ProcessEnv)).toThrow(/ADMIN_TOKEN/);
  });

  it("detects key mode from prefix", () => {
    expect(keyMode("sk_test_123")).toBe("test");
    expect(keyMode("sk_live_123")).toBe("live");
    expect(keyMode("rk_live_123")).toBe("live");
    expect(keyMode("pk_live_123")).toBeNull();
  });
});

describe("tokens", () => {
  const ent = deriveKey("root", "entitlement");
  const res = deriveKey("root", "restore");
  const now = 1_760_000_000_000;

  it("signs and verifies entitlement tokens", () => {
    const t = issueEntitlementToken("cus_123", ent, now);
    const v = verifyToken(t, ent, "ent");
    expect(v).toEqual({ ok: true, claims: { typ: "ent", cid: "cus_123", iat: now } });
  });

  it("rejects a token signed with another key or purpose", () => {
    const t = issueEntitlementToken("cus_123", ent, now);
    expect(verifyToken(t, res, "ent")).toEqual({ ok: false, reason: "bad-signature" });
    expect(verifyToken(t, deriveKey("rotated", "entitlement"), "ent")).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects tampered payloads", () => {
    const t = issueEntitlementToken("cus_123", ent, now);
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ typ: "ent", cid: "cus_999", iat: now })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, ent, "ent")).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects malformed tokens", () => {
    for (const t of ["", "abc", "a.b.c", ".sig", "body.", "x".repeat(3000)]) {
      expect(verifyToken(t, ent, "ent").ok).toBe(false);
    }
    const noCid = signToken({ typ: "ent", iat: now } as never, ent);
    expect(verifyToken(noCid, ent, "ent")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects the wrong token type even with a valid signature", () => {
    const t = issueRestoreToken("ash@pallet.town", ent, now);
    expect(verifyToken(t, ent, "ent")).toEqual({ ok: false, reason: "wrong-type" });
  });

  it("expires restore tokens after 30 minutes", () => {
    const t = issueRestoreToken("ash@pallet.town", res, now);
    expect(verifyToken(t, res, "restore", now + RESTORE_TTL_MS - 1).ok).toBe(true);
    expect(verifyToken(t, res, "restore", now + RESTORE_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("config resolution", () => {
  const env = { ADMIN_TOKEN: "admin-secret" } as unknown as NodeJS.ProcessEnv;
  const enc = (s: string) => encryptSecret(s, envKey("encryption", env));

  it("is off by default", () => {
    const c = resolveFromSettings(DEFAULT_SETTINGS, env);
    expect(c.enabled).toBe(false);
    expect(publicView(c)).toMatchObject({ enabled: false, mode: null });
  });

  it("decrypts admin-entered secrets and never exposes them", () => {
    const c = resolveFromSettings(
      {
        ...DEFAULT_SETTINGS,
        secretKeyEnc: enc("sk_test_supersecret1234"),
        secretKeyLast4: "1234",
        secretKeyMode: "test",
        webhookSecretEnc: enc("whsec_abcdefghij9876"),
        webhookSecretLast4: "9876",
        paymentsEnabled: true,
        priceIds: { "pro-monthly": "price_a", "pack-100": "price_b" },
      },
      env,
    );
    expect(c.secretKey).toBe("sk_test_supersecret1234");
    expect(c.secretKeySource).toBe("admin");
    expect(c.enabled).toBe(true);
    const view = JSON.stringify([adminView(c, env), publicView(c)]);
    expect(view).not.toContain("supersecret");
    expect(view).not.toContain("whsec_");
    expect(adminView(c, env).secretKey).toMatchObject({ configured: true, last4: "1234", mode: "test" });
  });

  it("env vars win over stored secrets", () => {
    const c = resolveFromSettings(
      { ...DEFAULT_SETTINGS, secretKeyEnc: enc("sk_test_stored000000") },
      { ...env, STRIPE_SECRET_KEY: "sk_live_fromenv00000" } as unknown as NodeJS.ProcessEnv,
    );
    expect(c.secretKey).toBe("sk_live_fromenv00000");
    expect(c.secretKeySource).toBe("env");
    expect(c.mode).toBe("live");
  });

  it("stays off when prices aren't synced, and flags unreadable secrets", () => {
    const c = resolveFromSettings(
      { ...DEFAULT_SETTINGS, secretKeyEnc: enc("sk_test_abcdefghijkl"), paymentsEnabled: true, priceIds: { "pro-monthly": "price_a" } },
      env,
    );
    expect(c.enabled).toBe(false);
    const rotated = resolveFromSettings({ ...DEFAULT_SETTINGS, secretKeyEnc: enc("sk_test_abcdefghijkl") }, { ADMIN_TOKEN: "new" } as unknown as NodeJS.ProcessEnv);
    expect(rotated.secretKey).toBeNull();
    expect(rotated.storedSecretUnreadable).toBe(true);
  });
});

describe("checkout params", () => {
  const common = { priceId: "price_x", origin: "https://www.sleeveorslab.com", clientReferenceId: "sos_ref" };
  it("subscription for Pro", () => {
    const p = buildCheckoutParams({ ...common, plan: "pro-monthly", variant: "pack-first" });
    expect(p).toMatchObject({
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: "sos_ref",
      success_url: "https://www.sleeveorslab.com/pricing/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://www.sleeveorslab.com/pricing",
      metadata: { app: "sleeveorslab", plan: "pro-monthly", variant: "pack-first" },
      subscription_data: { metadata: { plan: "pro-monthly" } },
    });
    expect(p.customer_creation).toBeUndefined();
  });
  it("payment with customer_creation=always for the pack", () => {
    const p = buildCheckoutParams({ ...common, plan: "pack-100", variant: null });
    expect(p).toMatchObject({ mode: "payment", customer_creation: "always", metadata: { variant: "none" } });
  });
  it("reuses a known customer instead of creating one", () => {
    const p = buildCheckoutParams({ ...common, plan: "pack-100", variant: null, customerId: "cus_1" });
    expect(p.customer).toBe("cus_1");
    expect(p.customer_creation).toBeUndefined();
  });
});
