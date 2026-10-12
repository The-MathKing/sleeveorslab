// Resolves billing config: env vars win over admin-tab secrets (which are stored encrypted).
// Only `resolveBillingConfig` ever holds plaintext secrets; `adminView`/`publicView` never do.
import { decryptSecret, envKey, keyMode, last4, rootSecret, type KeyMode } from "./crypto";
import { PAID_PLAN_IDS, publicPlans, type PaidPlanId, type PublicPlan } from "./plans";
import type { BillingSettingsRecord, BillingStore } from "./store";

export type SecretSource = "env" | "admin" | null;

export interface ResolvedBillingConfig {
  secretKey: string | null;
  secretKeySource: SecretSource;
  webhookSecret: string | null;
  webhookSecretSource: SecretSource;
  mode: KeyMode | null;
  /** True when a stored secret exists but can't be decrypted (root secret rotated). */
  storedSecretUnreadable: boolean;
  paymentsEnabledFlag: boolean;
  priceIds: Partial<Record<PaidPlanId, string>>;
  pricesSynced: boolean;
  splitTest: boolean;
  /** Payments are actually live for visitors: flag on + key + prices. */
  enabled: boolean;
  settings: BillingSettingsRecord;
}

export function resolveFromSettings(settings: BillingSettingsRecord, env: NodeJS.ProcessEnv = process.env): ResolvedBillingConfig {
  let storedSecretUnreadable = false;
  const fromStore = (blob: string | null): string | null => {
    if (!blob) return null;
    if (!rootSecret(env)) {
      storedSecretUnreadable = true;
      return null;
    }
    const v = decryptSecret(blob, envKey("encryption", env));
    if (v == null) storedSecretUnreadable = true;
    return v;
  };

  const envSk = env.STRIPE_SECRET_KEY?.trim() || null;
  const envWh = env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  const secretKey = envSk ?? fromStore(settings.secretKeyEnc);
  const webhookSecret = envWh ?? fromStore(settings.webhookSecretEnc);
  const pricesSynced = PAID_PLAN_IDS.every((id) => !!settings.priceIds[id]);
  return {
    secretKey,
    secretKeySource: envSk ? "env" : secretKey ? "admin" : null,
    webhookSecret,
    webhookSecretSource: envWh ? "env" : webhookSecret ? "admin" : null,
    mode: secretKey ? keyMode(secretKey) : null,
    storedSecretUnreadable,
    paymentsEnabledFlag: settings.paymentsEnabled,
    priceIds: settings.priceIds,
    pricesSynced,
    splitTest: settings.splitTest,
    enabled: settings.paymentsEnabled && !!secretKey && pricesSynced,
    settings,
  };
}

export async function resolveBillingConfig(store: BillingStore, env: NodeJS.ProcessEnv = process.env) {
  return resolveFromSettings(await store.getSettings(), env);
}

export interface SecretStatus {
  configured: boolean;
  source: SecretSource;
  last4: string | null;
}

export interface AdminBillingView {
  secretKey: SecretStatus & { mode: KeyMode | null };
  webhookSecret: SecretStatus;
  storedSecretUnreadable: boolean;
  encryptionKeyConfigured: boolean;
  paymentsEnabled: boolean;
  enabled: boolean;
  priceIds: Partial<Record<PaidPlanId, string>>;
  pricesSynced: boolean;
  splitTest: boolean;
  resendConfigured: boolean;
  updatedAt: string | null;
}

/** Safe for the admin client: no secret material beyond the last 4 characters. */
export function adminView(c: ResolvedBillingConfig, env: NodeJS.ProcessEnv = process.env): AdminBillingView {
  return {
    secretKey: {
      configured: !!c.secretKey,
      source: c.secretKeySource,
      last4: c.secretKey ? last4(c.secretKey) : c.settings.secretKeyLast4,
      mode: c.mode ?? c.settings.secretKeyMode,
    },
    webhookSecret: {
      configured: !!c.webhookSecret,
      source: c.webhookSecretSource,
      last4: c.webhookSecret ? last4(c.webhookSecret) : c.settings.webhookSecretLast4,
    },
    storedSecretUnreadable: c.storedSecretUnreadable,
    encryptionKeyConfigured: !!rootSecret(env),
    paymentsEnabled: c.paymentsEnabledFlag,
    enabled: c.enabled,
    priceIds: c.priceIds,
    pricesSynced: c.pricesSynced,
    splitTest: c.splitTest,
    resendConfigured: !!env.RESEND_API_KEY,
    updatedAt: c.settings.updatedAt,
  };
}

export interface PublicBillingConfig {
  enabled: boolean;
  mode: KeyMode | null;
  splitTest: boolean;
  plans: PublicPlan[];
}

export function publicView(c: ResolvedBillingConfig): PublicBillingConfig {
  return { enabled: c.enabled, mode: c.enabled ? c.mode : null, splitTest: c.enabled && c.splitTest, plans: publicPlans() };
}

/** Public config when the store itself is unreachable: payments off, plans still listed. */
export function fallbackPublicConfig(): PublicBillingConfig {
  return { enabled: false, mode: null, splitTest: false, plans: publicPlans() };
}
