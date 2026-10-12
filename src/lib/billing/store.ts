// Billing persistence: its own tiny schema, separate from src/lib/db. Two implementations
// with one contract (see store.contract.test.ts): SQL (Postgres in prod, PGlite in tests)
// and a JSON file for local dev. The store never sees plaintext secrets; config.ts encrypts.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { KeyMode } from "./crypto";
import type { PaidPlanId, PricingVariant } from "./plans";

/** Structurally identical to SqlClient in src/lib/db/postgres.ts. */
export interface BillingSqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface BillingSettingsRecord {
  secretKeyEnc: string | null;
  secretKeyLast4: string | null;
  secretKeyMode: KeyMode | null;
  webhookSecretEnc: string | null;
  webhookSecretLast4: string | null;
  paymentsEnabled: boolean;
  /** Stripe Price ids resolved from lookup keys by sync-products. */
  priceIds: Partial<Record<PaidPlanId, string>>;
  splitTest: boolean;
  updatedAt: string | null;
}

export type SettingsPatch = Partial<Omit<BillingSettingsRecord, "updatedAt">>;

export interface CustomerRecord {
  /** Stripe customer id (cus_...). */
  id: string;
  email: string | null;
  livemode: boolean;
  /** Remaining pack credits. */
  credits: number;
  subscriptionId: string | null;
  /** Stripe subscription status: active, trialing, past_due, canceled, unpaid, incomplete... */
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionState {
  subscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface PurchaseInput {
  /** Checkout Session id: the idempotency key. */
  id: string;
  customerId: string;
  plan: PaidPlanId;
  variant: PricingVariant | null;
  amountCents: number;
  currency: string;
  /** Credits granted by this purchase (0 for subscriptions). */
  credits: number;
  livemode: boolean;
  createdAt?: string;
}

export interface VariantRow {
  variant: string;
  purchases: number;
  pro: number;
  pack: number;
  revenueCents: number;
}

export interface BillingSummary {
  activeSubscriptions: number;
  packsSoldAllTime: number;
  packsSold30d: number;
  subscriptionsStarted30d: number;
  revenue30dCents: number;
  creditsOutstanding: number;
  /** Purchases in the window grouped by pricing-test arm ("none" = test off). */
  byVariant: VariantRow[];
}

export interface BillingStore {
  getSettings(): Promise<BillingSettingsRecord>;
  updateSettings(patch: SettingsPatch): Promise<BillingSettingsRecord>;
  getCustomer(id: string): Promise<CustomerRecord | null>;
  findCustomersByEmail(email: string): Promise<CustomerRecord[]>;
  findCustomerBySubscription(subscriptionId: string): Promise<CustomerRecord | null>;
  /** Insert or refresh a customer. A null email never overwrites a known one. */
  upsertCustomer(c: { id: string; email?: string | null; livemode?: boolean }): Promise<CustomerRecord>;
  setSubscription(customerId: string, s: SubscriptionState): Promise<CustomerRecord>;
  /** Idempotent by purchase id; grants credits exactly once. Customer must exist. */
  recordPurchase(p: PurchaseInput): Promise<{ inserted: boolean; credits: number }>;
  /** Atomically decrement. ok=false (nothing changed) when there aren't enough credits. */
  consumeCredits(customerId: string, n: number): Promise<{ ok: boolean; creditsRemaining: number }>;
  /** Returns true the first time an event id is seen. */
  beginEvent(id: string, type: string): Promise<boolean>;
  /** Undo beginEvent after a handler failure so Stripe's retry is processed. */
  forgetEvent(id: string): Promise<void>;
  summary(opts: { since: Date; livemode?: boolean | null }): Promise<BillingSummary>;
}

export const DEFAULT_SETTINGS: BillingSettingsRecord = {
  secretKeyEnc: null,
  secretKeyLast4: null,
  secretKeyMode: null,
  webhookSecretEnc: null,
  webhookSecretLast4: null,
  paymentsEnabled: false,
  priceIds: {},
  splitTest: false,
  updatedAt: null,
};

export const ACTIVE_SUB_STATUSES = ["active", "trialing", "past_due"] as const;
export function isActiveSubStatus(s: string | null | undefined): boolean {
  return !!s && (ACTIVE_SUB_STATUSES as readonly string[]).includes(s);
}

export function normalizeBillingEmail(email: string): string {
  return email.trim().toLowerCase();
}

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const json = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};

/* ======================= SQL ======================= */

export const BILLING_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS billing_settings (
     id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
     secret_key_enc text,
     secret_key_last4 text,
     secret_key_mode text,
     webhook_secret_enc text,
     webhook_secret_last4 text,
     payments_enabled boolean NOT NULL DEFAULT false,
     price_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
     split_test boolean NOT NULL DEFAULT false,
     updated_at timestamptz
   )`,
  `CREATE TABLE IF NOT EXISTS customers (
     id text PRIMARY KEY,
     email text,
     livemode boolean NOT NULL DEFAULT false,
     credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
     subscription_id text,
     subscription_status text,
     current_period_end timestamptz,
     cancel_at_period_end boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL,
     updated_at timestamptz NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email)`,
  `CREATE INDEX IF NOT EXISTS customers_subscription_idx ON customers (subscription_id)`,
  `CREATE TABLE IF NOT EXISTS purchases (
     id text PRIMARY KEY,
     customer_id text NOT NULL,
     plan text NOT NULL,
     variant text,
     amount_cents integer NOT NULL DEFAULT 0,
     currency text NOT NULL DEFAULT 'usd',
     credits integer NOT NULL DEFAULT 0,
     livemode boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS purchases_created_idx ON purchases (created_at)`,
  `CREATE TABLE IF NOT EXISTS stripe_events (
     id text PRIMARY KEY,
     type text NOT NULL,
     received_at timestamptz NOT NULL
   )`,
];

interface CustomerRow {
  id: string;
  email: string | null;
  livemode: boolean;
  credits: number | string;
  subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: unknown;
  cancel_at_period_end: boolean;
  created_at: unknown;
  updated_at: unknown;
}

function rowToCustomer(r: CustomerRow): CustomerRecord {
  return {
    id: r.id,
    email: r.email,
    livemode: !!r.livemode,
    credits: Number(r.credits),
    subscriptionId: r.subscription_id,
    subscriptionStatus: r.subscription_status,
    currentPeriodEnd: iso(r.current_period_end),
    cancelAtPeriodEnd: !!r.cancel_at_period_end,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

// Patchable settings: property → column. Fixed map, so dynamic SET clauses stay injection-free.
const SETTINGS_COLUMNS: Record<keyof SettingsPatch, { col: string; cast?: string }> = {
  secretKeyEnc: { col: "secret_key_enc" },
  secretKeyLast4: { col: "secret_key_last4" },
  secretKeyMode: { col: "secret_key_mode" },
  webhookSecretEnc: { col: "webhook_secret_enc" },
  webhookSecretLast4: { col: "webhook_secret_last4" },
  paymentsEnabled: { col: "payments_enabled" },
  priceIds: { col: "price_ids", cast: "::jsonb" },
  splitTest: { col: "split_test" },
};

export function createSqlBillingStore(sql: BillingSqlClient, now: () => Date = () => new Date()): BillingStore {
  let ready: Promise<void> | null = null;
  const ensure = () => {
    ready ??= (async () => {
      for (const stmt of BILLING_SCHEMA_SQL) await sql.query(stmt);
      await sql.query(`INSERT INTO billing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    })().catch((err) => {
      ready = null;
      throw err;
    });
    return ready;
  };
  const ts = () => now().toISOString();

  const getCustomer = async (id: string) => {
    await ensure();
    const [r] = await sql.query<CustomerRow>(`SELECT * FROM customers WHERE id = $1`, [id]);
    return r ? rowToCustomer(r) : null;
  };

  const getSettings = async (): Promise<BillingSettingsRecord> => {
    await ensure();
    const [r] = await sql.query<Record<string, unknown>>(`SELECT * FROM billing_settings WHERE id = 1`);
    if (!r) return { ...DEFAULT_SETTINGS };
    return {
      secretKeyEnc: (r.secret_key_enc as string | null) ?? null,
      secretKeyLast4: (r.secret_key_last4 as string | null) ?? null,
      secretKeyMode: (r.secret_key_mode as KeyMode | null) ?? null,
      webhookSecretEnc: (r.webhook_secret_enc as string | null) ?? null,
      webhookSecretLast4: (r.webhook_secret_last4 as string | null) ?? null,
      paymentsEnabled: !!r.payments_enabled,
      priceIds: json(r.price_ids, {}),
      splitTest: !!r.split_test,
      updatedAt: iso(r.updated_at),
    };
  };

  return {
    getSettings,

    async updateSettings(patch) {
      await ensure();
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const [k, v] of Object.entries(patch) as [keyof SettingsPatch, unknown][]) {
        const spec = SETTINGS_COLUMNS[k];
        if (!spec || v === undefined) continue;
        params.push(k === "priceIds" ? JSON.stringify(v ?? {}) : v);
        sets.push(`${spec.col} = $${params.length}${spec.cast ?? ""}`);
      }
      params.push(ts());
      sets.push(`updated_at = $${params.length}::timestamptz`);
      await sql.query(`UPDATE billing_settings SET ${sets.join(", ")} WHERE id = 1`, params);
      return getSettings();
    },

    getCustomer,

    async findCustomersByEmail(email) {
      await ensure();
      const rows = await sql.query<CustomerRow>(`SELECT * FROM customers WHERE email = $1 ORDER BY created_at DESC`, [
        normalizeBillingEmail(email),
      ]);
      return rows.map(rowToCustomer);
    },

    async findCustomerBySubscription(subscriptionId) {
      await ensure();
      const [r] = await sql.query<CustomerRow>(`SELECT * FROM customers WHERE subscription_id = $1 LIMIT 1`, [subscriptionId]);
      return r ? rowToCustomer(r) : null;
    },

    async upsertCustomer(c) {
      await ensure();
      const t = ts();
      const [r] = await sql.query<CustomerRow>(
        `INSERT INTO customers (id, email, livemode, created_at, updated_at)
         VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, customers.email),
           livemode = EXCLUDED.livemode OR customers.livemode,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [c.id, c.email ? normalizeBillingEmail(c.email) : null, c.livemode === true, t],
      );
      return rowToCustomer(r!);
    },

    async setSubscription(customerId, s) {
      await ensure();
      const t = ts();
      const [r] = await sql.query<CustomerRow>(
        `INSERT INTO customers (id, subscription_id, subscription_status, current_period_end, cancel_at_period_end, created_at, updated_at)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6::timestamptz, $6::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           subscription_id = EXCLUDED.subscription_id,
           subscription_status = EXCLUDED.subscription_status,
           current_period_end = EXCLUDED.current_period_end,
           cancel_at_period_end = EXCLUDED.cancel_at_period_end,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [customerId, s.subscriptionId, s.status, s.currentPeriodEnd, s.cancelAtPeriodEnd, t],
      );
      return rowToCustomer(r!);
    },

    async recordPurchase(p) {
      await ensure();
      // One statement: the insert and the credit grant commit together, and a replayed
      // purchase id inserts nothing, so the UPDATE matches no rows.
      const rows = await sql.query<{ credits: number | string }>(
        `WITH ins AS (
           INSERT INTO purchases (id, customer_id, plan, variant, amount_cents, currency, credits, livemode, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
           ON CONFLICT (id) DO NOTHING
           RETURNING customer_id, credits
         )
         UPDATE customers SET credits = customers.credits + ins.credits, updated_at = $10::timestamptz
         FROM ins WHERE customers.id = ins.customer_id
         RETURNING customers.credits`,
        [p.id, p.customerId, p.plan, p.variant, p.amountCents, p.currency, p.credits, p.livemode, p.createdAt ?? ts(), ts()],
      );
      if (rows.length) return { inserted: true, credits: Number(rows[0]!.credits) };
      const c = await getCustomer(p.customerId);
      return { inserted: false, credits: c?.credits ?? 0 };
    },

    async consumeCredits(customerId, n) {
      await ensure();
      const rows = await sql.query<{ credits: number | string }>(
        `UPDATE customers SET credits = credits - $2, updated_at = $3::timestamptz
         WHERE id = $1 AND credits >= $2 RETURNING credits`,
        [customerId, n, ts()],
      );
      if (rows.length) return { ok: true, creditsRemaining: Number(rows[0]!.credits) };
      const c = await getCustomer(customerId);
      return { ok: false, creditsRemaining: c?.credits ?? 0 };
    },

    async beginEvent(id, type) {
      await ensure();
      const rows = await sql.query(
        `INSERT INTO stripe_events (id, type, received_at) VALUES ($1, $2, $3::timestamptz) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [id, type, ts()],
      );
      return rows.length > 0;
    },

    async forgetEvent(id) {
      await ensure();
      await sql.query(`DELETE FROM stripe_events WHERE id = $1`, [id]);
    },

    async summary({ since, livemode = null }) {
      await ensure();
      const modeSql = (alias: string, idx: number) => (livemode == null ? "" : ` AND ${alias}livemode = $${idx}`);
      const modeParams = livemode == null ? [] : [livemode];
      const [subs] = await sql.query<{ n: unknown; credits: unknown }>(
        `SELECT count(*) FILTER (WHERE subscription_status IN ('active','trialing','past_due')) AS n,
                COALESCE(sum(credits), 0) AS credits
         FROM customers WHERE true${modeSql("", 1)}`,
        modeParams,
      );
      const [packs] = await sql.query<{ n: unknown }>(
        `SELECT count(*) AS n FROM purchases WHERE plan = 'pack-100'${modeSql("", 1)}`,
        modeParams,
      );
      const groups = await sql.query<{ plan: string; variant: string | null; n: unknown; cents: unknown }>(
        `SELECT plan, variant, count(*) AS n, COALESCE(sum(amount_cents), 0) AS cents
         FROM purchases WHERE created_at >= $1::timestamptz${modeSql("", 2)}
         GROUP BY plan, variant`,
        [since.toISOString(), ...modeParams],
      );
      return buildSummary(
        Number(subs?.n ?? 0),
        Number(subs?.credits ?? 0),
        Number(packs?.n ?? 0),
        groups.map((g) => ({ plan: g.plan, variant: g.variant, n: Number(g.n), cents: Number(g.cents) })),
      );
    },
  };
}

function buildSummary(
  activeSubscriptions: number,
  creditsOutstanding: number,
  packsSoldAllTime: number,
  groups: Array<{ plan: string; variant: string | null; n: number; cents: number }>,
): BillingSummary {
  const byVariant = new Map<string, VariantRow>();
  let packsSold30d = 0;
  let subscriptionsStarted30d = 0;
  let revenue30dCents = 0;
  for (const g of groups) {
    const key = g.variant ?? "none";
    const row = byVariant.get(key) ?? { variant: key, purchases: 0, pro: 0, pack: 0, revenueCents: 0 };
    row.purchases += g.n;
    row.revenueCents += g.cents;
    if (g.plan === "pack-100") {
      row.pack += g.n;
      packsSold30d += g.n;
    } else {
      row.pro += g.n;
      subscriptionsStarted30d += g.n;
    }
    revenue30dCents += g.cents;
    byVariant.set(key, row);
  }
  return {
    activeSubscriptions,
    packsSoldAllTime,
    packsSold30d,
    subscriptionsStarted30d,
    revenue30dCents,
    creditsOutstanding,
    byVariant: [...byVariant.values()].sort((a, b) => a.variant.localeCompare(b.variant)),
  };
}

/* ======================= file (local dev) ======================= */

interface FileShape {
  settings: BillingSettingsRecord;
  customers: Record<string, CustomerRecord>;
  purchases: Record<string, PurchaseInput & { createdAt: string }>;
  events: Record<string, { type: string; receivedAt: string }>;
}

const fileQueues = new Map<string, Promise<unknown>>();

export function createFileBillingStore(dir: string, now: () => Date = () => new Date()): BillingStore {
  const file = path.join(dir, "billing.json");
  const ts = () => now().toISOString();

  async function read(): Promise<FileShape> {
    try {
      const raw = JSON.parse(await fs.readFile(file, "utf8")) as Partial<FileShape>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...raw.settings },
        customers: raw.customers ?? {},
        purchases: raw.purchases ?? {},
        events: raw.events ?? {},
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { settings: { ...DEFAULT_SETTINGS }, customers: {}, purchases: {}, events: {} };
      }
      throw err;
    }
  }

  async function write(data: FileShape): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    await fs.rename(tmp, file);
  }

  /** Serialize read-modify-write per file so concurrent calls can't lose updates. */
  function tx<T>(fn: (d: FileShape) => T | Promise<T>, mutate = true): Promise<T> {
    const prev = fileQueues.get(file) ?? Promise.resolve();
    const run = prev.then(async () => {
      const d = await read();
      const out = await fn(d);
      if (mutate) await write(d);
      return out;
    });
    const tail = run.catch(() => {});
    fileQueues.set(file, tail);
    void tail.then(() => {
      if (fileQueues.get(file) === tail) fileQueues.delete(file);
    });
    return run;
  }

  const blankCustomer = (id: string): CustomerRecord => ({
    id,
    email: null,
    livemode: false,
    credits: 0,
    subscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: ts(),
    updatedAt: ts(),
  });
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    getSettings: () => tx((d) => clone(d.settings), false),

    updateSettings: (patch) =>
      tx((d) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v !== undefined && k in SETTINGS_COLUMNS) (d.settings as unknown as Record<string, unknown>)[k] = v;
        }
        d.settings.updatedAt = ts();
        return clone(d.settings);
      }),

    getCustomer: (id) => tx((d) => (d.customers[id] ? clone(d.customers[id]) : null), false),

    findCustomersByEmail: (email) =>
      tx((d) => {
        const e = normalizeBillingEmail(email);
        return Object.values(d.customers)
          .filter((c) => c.email === e)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(clone);
      }, false),

    findCustomerBySubscription: (subscriptionId) =>
      tx((d) => {
        const c = Object.values(d.customers).find((x) => x.subscriptionId === subscriptionId);
        return c ? clone(c) : null;
      }, false),

    upsertCustomer: (c) =>
      tx((d) => {
        const cur = d.customers[c.id] ?? blankCustomer(c.id);
        if (c.email) cur.email = normalizeBillingEmail(c.email);
        cur.livemode = cur.livemode || c.livemode === true;
        cur.updatedAt = ts();
        d.customers[c.id] = cur;
        return clone(cur);
      }),

    setSubscription: (customerId, s) =>
      tx((d) => {
        const cur = d.customers[customerId] ?? blankCustomer(customerId);
        cur.subscriptionId = s.subscriptionId;
        cur.subscriptionStatus = s.status;
        cur.currentPeriodEnd = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString() : null;
        cur.cancelAtPeriodEnd = s.cancelAtPeriodEnd;
        cur.updatedAt = ts();
        d.customers[customerId] = cur;
        return clone(cur);
      }),

    recordPurchase: (p) =>
      tx((d) => {
        const cust = d.customers[p.customerId];
        if (d.purchases[p.id] || !cust) return { inserted: false, credits: cust?.credits ?? 0 };
        d.purchases[p.id] = { ...p, createdAt: p.createdAt ?? ts() };
        cust.credits += p.credits;
        cust.updatedAt = ts();
        return { inserted: true, credits: cust.credits };
      }),

    consumeCredits: (customerId, n) =>
      tx((d) => {
        const c = d.customers[customerId];
        if (!c || c.credits < n) return { ok: false, creditsRemaining: c?.credits ?? 0 };
        c.credits -= n;
        c.updatedAt = ts();
        return { ok: true, creditsRemaining: c.credits };
      }),

    beginEvent: (id, type) =>
      tx((d) => {
        if (d.events[id]) return false;
        d.events[id] = { type, receivedAt: ts() };
        return true;
      }),

    forgetEvent: (id) =>
      tx((d) => {
        delete d.events[id];
      }),

    summary: ({ since, livemode = null }) =>
      tx((d) => {
        const modeOk = (x: { livemode: boolean }) => livemode == null || x.livemode === livemode;
        const customers = Object.values(d.customers).filter(modeOk);
        const purchases = Object.values(d.purchases).filter(modeOk);
        const groups = new Map<string, { plan: string; variant: string | null; n: number; cents: number }>();
        for (const p of purchases) {
          if (Date.parse(p.createdAt) < since.getTime()) continue;
          const k = `${p.plan}|${p.variant ?? ""}`;
          const g = groups.get(k) ?? { plan: p.plan, variant: p.variant, n: 0, cents: 0 };
          g.n++;
          g.cents += p.amountCents;
          groups.set(k, g);
        }
        return buildSummary(
          customers.filter((c) => isActiveSubStatus(c.subscriptionStatus)).length,
          customers.reduce((a, c) => a + c.credits, 0),
          purchases.filter((p) => p.plan === "pack-100").length,
          [...groups.values()],
        );
      }, false),
  };
}
