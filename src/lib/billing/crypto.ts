// Server-only crypto for billing: AES-256-GCM for secrets at rest, HMAC-SHA256 compact tokens
// for entitlements and restore links. All keys are derived with HKDF-SHA256 from one root
// secret: BILLING_ENCRYPTION_KEY if set, else ADMIN_TOKEN. Rotating the root makes stored
// secrets unreadable (re-paste them) and signs everyone out (they use "Restore purchase").
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

const SALT = "sleeveorslab/billing/v1";
export const KEY_INFO = {
  encryption: "sos-billing-secrets-aes256gcm-v1",
  entitlement: "sos-billing-entitlement-hmac-v1",
  restore: "sos-billing-restore-hmac-v1",
} as const;
export type KeyPurpose = keyof typeof KEY_INFO;

export class BillingKeyMissingError extends Error {
  constructor() {
    super("Billing needs ADMIN_TOKEN or BILLING_ENCRYPTION_KEY to be set");
  }
}

export function rootSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env.BILLING_ENCRYPTION_KEY?.trim() || env.ADMIN_TOKEN?.trim();
  return v ? v : null;
}

export function deriveKey(root: string, purpose: KeyPurpose): Buffer {
  return Buffer.from(hkdfSync("sha256", root, SALT, KEY_INFO[purpose], 32));
}

/** Key for `purpose` from env; throws BillingKeyMissingError when no root secret is set. */
export function envKey(purpose: KeyPurpose, env: NodeJS.ProcessEnv = process.env): Buffer {
  const root = rootSecret(env);
  if (!root) throw new BillingKeyMissingError();
  return deriveKey(root, purpose);
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");
const AAD = Buffer.from("sos-billing-secret");

/** "v1.<iv>.<ciphertext>.<tag>", all base64url. */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(AAD);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", b64u(iv), b64u(ct), b64u(c.getAuthTag())].join(".");
}

/** Returns null if the blob is malformed, tampered with, or was encrypted under another key. */
export function decryptSecret(blob: string, key: Buffer): string | null {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, fromB64u(parts[1]!));
    d.setAAD(AAD);
    d.setAuthTag(fromB64u(parts[3]!));
    return Buffer.concat([d.update(fromB64u(parts[2]!)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---------------- compact signed tokens ---------------- */

export interface EntitlementClaims {
  typ: "ent";
  /** Stripe customer id. */
  cid: string;
  /** Issued at, ms since epoch. */
  iat: number;
}

export interface RestoreClaims {
  typ: "restore";
  /** Normalized email. */
  em: string;
  iat: number;
  /** Expiry, ms since epoch. */
  exp: number;
}

export type TokenClaims = EntitlementClaims | RestoreClaims;

function mac(body: string, key: Buffer): string {
  return b64u(createHmac("sha256", key).update(body).digest());
}

/** "<base64url(json)>.<base64url(hmac)>" */
export function signToken(claims: TokenClaims, key: Buffer): string {
  const body = b64u(Buffer.from(JSON.stringify(claims), "utf8"));
  return `${body}.${mac(body, key)}`;
}

export type VerifyFailure = "malformed" | "bad-signature" | "wrong-type" | "expired";

export function verifyToken<T extends TokenClaims["typ"]>(
  token: string,
  key: Buffer,
  typ: T,
  now = Date.now(),
): { ok: true; claims: Extract<TokenClaims, { typ: T }> } | { ok: false; reason: VerifyFailure } {
  if (typeof token !== "string" || token.length > 2048) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, sig] = parts as [string, string];
  const expected = Buffer.from(mac(body, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "bad-signature" };
  let claims: unknown;
  try {
    claims = JSON.parse(fromB64u(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!claims || typeof claims !== "object") return { ok: false, reason: "malformed" };
  const c = claims as Record<string, unknown>;
  if (c.typ !== typ) return { ok: false, reason: "wrong-type" };
  if (typeof c.iat !== "number") return { ok: false, reason: "malformed" };
  if (typ === "ent" && (typeof c.cid !== "string" || !c.cid)) return { ok: false, reason: "malformed" };
  if (typ === "restore") {
    if (typeof c.em !== "string" || typeof c.exp !== "number") return { ok: false, reason: "malformed" };
    if (now > c.exp) return { ok: false, reason: "expired" };
  }
  return { ok: true, claims: claims as Extract<TokenClaims, { typ: T }> };
}

export const RESTORE_TTL_MS = 30 * 60_000;

export function issueEntitlementToken(customerId: string, key: Buffer, now = Date.now()): string {
  return signToken({ typ: "ent", cid: customerId, iat: now }, key);
}

export function issueRestoreToken(email: string, key: Buffer, now = Date.now()): string {
  return signToken({ typ: "restore", em: email, iat: now, exp: now + RESTORE_TTL_MS }, key);
}

/* ---------------- display helpers ---------------- */

export type KeyMode = "test" | "live";

/** Mode from a Stripe secret/restricted key prefix (sk_test_, sk_live_, rk_test_, rk_live_). */
export function keyMode(key: string): KeyMode | null {
  const m = /^(?:sk|rk)_(test|live)_/.exec(key.trim());
  return m ? (m[1] as KeyMode) : null;
}

export function last4(secret: string): string {
  return secret.trim().slice(-4);
}
