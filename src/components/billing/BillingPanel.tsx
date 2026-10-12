"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Field, Input, Spinner, Stat, formatUsd, useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";

/* ---------------- types (mirror the admin API responses) ---------------- */

interface SecretStatus {
  configured: boolean;
  source: "env" | "admin" | null;
  last4: string | null;
}
interface AdminSettings {
  secretKey: SecretStatus & { mode: "test" | "live" | null };
  webhookSecret: SecretStatus;
  storedSecretUnreadable: boolean;
  encryptionKeyConfigured: boolean;
  paymentsEnabled: boolean;
  enabled: boolean;
  priceIds: Partial<Record<"pro-monthly" | "pack-100", string>>;
  pricesSynced: boolean;
  splitTest: boolean;
  resendConfigured: boolean;
  updatedAt: string | null;
}
interface SettingsResponse {
  settings: AdminSettings;
  webhookEvents: string[];
}
interface TestResponse {
  mode: "test" | "live" | null;
  account: {
    id: string;
    name: string | null;
    country: string | null;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    requirementsDue: number;
  };
}
interface SummaryResponse {
  mode: "test" | "live" | null;
  windowDays: number;
  summary: {
    activeSubscriptions: number;
    packsSoldAllTime: number;
    packsSold30d: number;
    subscriptionsStarted30d: number;
    revenue30dCents: number;
    creditsOutstanding: number;
    byVariant: Array<{ variant: string; purchases: number; pro: number; pack: number; revenueCents: number }>;
  };
}

/* ---------------- fetch ---------------- */

async function adminCall<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-admin-token", token);
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const j = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(j?.error || `Request failed (${res.status})`);
  return j as T;
}

/* ---------------- small pieces ---------------- */

function Switch({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-60")}>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {description && <div className="mt-0.5 text-xs text-ink-3">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed",
          checked ? "bg-ink" : "bg-line-strong",
        )}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={cn("absolute top-1 size-5 rounded-full bg-card shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")}
        />
      </button>
    </div>
  );
}

function CopyRow({ value, label }: { value: string; label: string }) {
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-[8px] bg-paper-2 px-2.5 py-2 font-mono text-xs text-ink">{value}</code>
      <Button
        size="sm"
        variant="outline"
        iconLeft={<Copy className="size-3.5" aria-hidden="true" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast({ tone: "good", title: `${label} copied` });
          } catch {
            toast({ tone: "bad", title: "Couldn't copy. Select it and copy by hand." });
          }
        }}
      >
        Copy
      </Button>
    </div>
  );
}

function secretLine(s: SecretStatus): string {
  if (!s.configured) return s.last4 ? `stored ••••${s.last4}, but unreadable` : "not set";
  return `••••${s.last4 ?? "????"} · from ${s.source === "env" ? "Vercel env var" : "this tab"}`;
}

/* ---------------- panel ---------------- */

/** Admin → Billing tab. Mount with the admin token; it talks to /api/admin/billing/*. */
export function BillingPanel({ adminToken }: { adminToken: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [test, setTest] = useState<TestResponse | null>(null);
  const [busy, setBusy] = useState<null | "save" | "test" | "sync" | "toggle" | "split">(null);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    try {
      setData(await adminCall<SettingsResponse>(adminToken, "/api/admin/billing/settings"));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load billing settings");
    }
    adminCall<SummaryResponse>(adminToken, "/api/admin/billing/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [adminToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const fail = (title: string, err: unknown) =>
    toast({ tone: "bad", title, description: err instanceof Error ? err.message : undefined, duration: 8000 });

  const post = async (body: Record<string, unknown>) =>
    setData(await adminCall<SettingsResponse>(adminToken, "/api/admin/billing/settings", { method: "POST", body: JSON.stringify(body) }));

  const saveKeys = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = {};
    if (secretKey.trim()) body.secretKey = secretKey.trim();
    if (webhookSecret.trim()) body.webhookSecret = webhookSecret.trim();
    if (!Object.keys(body).length) return;
    setBusy("save");
    try {
      await post(body);
      setSecretKey("");
      setWebhookSecret("");
      setTest(null);
      toast({ tone: "good", title: "Saved (encrypted)", description: body.secretKey ? "New key: payments are off and prices need re-creating." : undefined });
    } catch (err) {
      fail("Couldn't save keys", err);
    } finally {
      setBusy(null);
    }
  };

  const clearSecret = async (which: "secretKey" | "webhookSecret") => {
    if (!window.confirm("Remove this stored secret?")) return;
    setBusy("save");
    try {
      await post({ [which]: null });
      toast({ tone: "neutral", title: "Removed" });
    } catch (err) {
      fail("Couldn't remove", err);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy("test");
    try {
      setTest(await adminCall<TestResponse>(adminToken, "/api/admin/billing/test", { method: "POST" }));
    } catch (err) {
      setTest(null);
      fail("Connection test failed", err);
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const r = await adminCall<{ prices: Array<{ plan: string; priceId: string; created: boolean }> }>(
        adminToken,
        "/api/admin/billing/sync-products",
        { method: "POST" },
      );
      const created = r.prices.filter((p) => p.created).length;
      toast({ tone: "good", title: created ? `Created ${created} price${created === 1 ? "" : "s"}` : "Products & prices already in place" });
      await load();
    } catch (err) {
      fail("Couldn't create products & prices", err);
    } finally {
      setBusy(null);
    }
  };

  const togglePayments = async (on: boolean) => {
    const live = data?.settings.secretKey.mode === "live";
    if (on && live && !window.confirm("Turn on LIVE payments? Real cards will be charged. Only do this once the guardian owns the Stripe account.")) return;
    setBusy("toggle");
    try {
      await post({ paymentsEnabled: on });
      toast({ tone: on ? "good" : "neutral", title: on ? "Payments are on" : "Payments are off" });
    } catch (err) {
      fail("Couldn't change payments", err);
    } finally {
      setBusy(null);
    }
  };

  const toggleSplit = async (on: boolean) => {
    setBusy("split");
    try {
      await post({ splitTest: on });
    } catch (err) {
      fail("Couldn't change the pricing test", err);
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <Card padding="lg">
        <p className="text-sm text-bad">{loadError}</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card padding="lg" className="flex items-center gap-3">
        <Spinner label="" /> <span className="text-sm text-ink-2">Loading billing…</span>
      </Card>
    );
  }

  const s = data.settings;
  const mode = s.secretKey.mode;
  const canEnable = s.secretKey.configured && s.pricesSynced && s.webhookSecret.configured;
  const webhookUrl = `${origin}/api/stripe/webhook`;
  const sum = summary?.summary;

  return (
    <div className="flex flex-col gap-4">
      {/* status */}
      <Card padding="lg">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle as="h2" className="mr-auto">
            Billing
          </CardTitle>
          <Badge tone={mode === "live" ? "slab" : mode === "test" ? "sleeve" : "neutral"} size="md">
            {mode === "live" ? "Live mode" : mode === "test" ? "Test mode" : "No Stripe key"}
          </Badge>
          <Badge tone={s.enabled ? "good" : "neutral"} size="md">
            {s.enabled ? "Payments on" : "Payments off"}
          </Badge>
        </div>
        {!s.encryptionKeyConfigured && (
          <p className="mt-3 text-sm text-bad">ADMIN_TOKEN / BILLING_ENCRYPTION_KEY isn&apos;t set, so keys can&apos;t be stored here.</p>
        )}
        {s.storedSecretUnreadable && (
          <p className="mt-3 text-sm text-bad">
            A stored secret can&apos;t be decrypted (ADMIN_TOKEN or BILLING_ENCRYPTION_KEY changed). Paste the keys again.
          </p>
        )}
      </Card>

      {/* keys */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>1 · Stripe keys</CardTitle>
          <CardDescription>
            Encrypted at rest (AES-256-GCM). Only the last 4 characters are ever shown. Vercel env vars STRIPE_SECRET_KEY /
            STRIPE_WEBHOOK_SECRET override anything saved here.
          </CardDescription>
        </CardHeader>
        <dl className="mb-4 grid gap-1 font-mono text-xs text-ink-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
          <dt className="text-ink-3">Secret key</dt>
          <dd className="flex items-center gap-2">
            {secretLine(s.secretKey)}
            {s.secretKey.source !== "env" && s.secretKey.last4 && (
              <button type="button" className="underline" onClick={() => void clearSecret("secretKey")}>
                remove
              </button>
            )}
          </dd>
          <dt className="text-ink-3">Webhook secret</dt>
          <dd className="flex items-center gap-2">
            {secretLine(s.webhookSecret)}
            {s.webhookSecret.source !== "env" && s.webhookSecret.last4 && (
              <button type="button" className="underline" onClick={() => void clearSecret("webhookSecret")}>
                remove
              </button>
            )}
          </dd>
        </dl>
        <form onSubmit={saveKeys} className="flex flex-col gap-3" autoComplete="off">
          <Field label="Secret key" hint="sk_test_… while testing. Restricted keys (rk_…) work too.">
            <Input type="password" mono autoComplete="off" spellCheck={false} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="sk_test_…" />
          </Field>
          <Field label="Webhook signing secret" hint="From the webhook endpoint you add in step 3.">
            <Input type="password" mono autoComplete="off" spellCheck={false} value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="whsec_…" />
          </Field>
          <div>
            <Button type="submit" loading={busy === "save"} disabled={!secretKey.trim() && !webhookSecret.trim()}>
              Save keys
            </Button>
          </div>
        </form>
      </Card>

      {/* test + sync */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>2 · Check the account, create prices</CardTitle>
          <CardDescription>The test shows whether this Stripe account can take money yet. Creating prices is safe to repeat.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" loading={busy === "test"} disabled={!s.secretKey.configured} onClick={() => void runTest()}>
            Test connection
          </Button>
          <Button variant="outline" loading={busy === "sync"} disabled={!s.secretKey.configured} onClick={() => void sync()}>
            Create products &amp; prices
          </Button>
        </div>
        {test && (
          <dl className="mt-4 grid gap-1 font-mono text-xs text-ink-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
            <dt className="text-ink-3">Account</dt>
            <dd>
              {test.account.name ?? "(no business name yet)"} · {test.account.id}
            </dd>
            <dt className="text-ink-3">Country</dt>
            <dd>{test.account.country ?? "—"}</dd>
            <dt className="text-ink-3">Can take payments</dt>
            <dd className={test.account.chargesEnabled ? "text-good" : "text-bad"}>{test.account.chargesEnabled ? "yes" : "no"}</dd>
            <dt className="text-ink-3">Details submitted</dt>
            <dd className={test.account.detailsSubmitted ? "text-good" : "text-bad"}>{test.account.detailsSubmitted ? "yes" : "no"}</dd>
            <dt className="text-ink-3">Payouts enabled</dt>
            <dd>{test.account.payoutsEnabled ? "yes" : "no"}</dd>
            {test.account.requirementsDue > 0 && (
              <>
                <dt className="text-ink-3">Stripe needs</dt>
                <dd className="text-bad">{test.account.requirementsDue} item(s), see the Stripe dashboard</dd>
              </>
            )}
          </dl>
        )}
        <dl className="mt-4 grid gap-1 font-mono text-xs text-ink-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
          <dt className="text-ink-3">Pro price</dt>
          <dd>{s.priceIds["pro-monthly"] ?? "not created"}</dd>
          <dt className="text-ink-3">Pack price</dt>
          <dd>{s.priceIds["pack-100"] ?? "not created"}</dd>
        </dl>
      </Card>

      {/* webhook */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>3 · Webhook</CardTitle>
          <CardDescription>
            In Stripe → Developers → Webhooks, add an endpoint with this URL and exactly these events, then paste its signing
            secret in step 1. Test and live mode each need their own endpoint.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <CopyRow label="Webhook URL" value={webhookUrl} />
          <CopyRow label="Event list" value={data.webhookEvents.join(", ")} />
          <ul className="flex flex-wrap gap-1.5">
            {data.webhookEvents.map((e) => (
              <li key={e}>
                <Badge>{e}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* switches */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>4 · Switches</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-5">
          <Switch
            checked={s.paymentsEnabled}
            disabled={busy === "toggle" || (!s.paymentsEnabled && !canEnable)}
            onChange={(v) => void togglePayments(v)}
            label="Payments enabled"
            description={
              canEnable
                ? "Shows buy buttons on /pricing and in the scan flow. Off = waitlist."
                : "Needs a secret key, the webhook secret, and created prices first."
            }
          />
          {mode === "live" && (
            <p className="flex gap-2 rounded-[10px] bg-borderline-soft p-3 text-sm text-borderline-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Live mode charges real cards. Per the plan, the Stripe account must be owned by a parent or legal guardian before
              payments are switched on. Use &ldquo;Test connection&rdquo; to check whose account this is.
            </p>
          )}
          <Switch
            checked={s.splitTest}
            disabled={busy === "split"}
            onChange={(v) => void toggleSplit(v)}
            label="Pricing test: $6.99/mo vs $19 pack"
            description="Each visitor gets 'monthly-first' or 'pack-first' (50/50, remembered in their browser). Order and highlight change; prices don't."
          />
          {!s.resendConfigured && (
            <p className="text-xs text-ink-3">
              RESEND_API_KEY isn&apos;t set, so &ldquo;Restore purchase&rdquo; tells buyers to email hello@sleeveorslab.com instead of
              sending a link.
            </p>
          )}
        </div>
      </Card>

      {/* summary */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Numbers {summary?.mode ? `(${summary.mode} mode)` : ""}</CardTitle>
          <CardDescription>Revenue counts first payments at checkout; renewals are in the Stripe dashboard.</CardDescription>
        </CardHeader>
        {sum ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat size="sm" label="Active Pro" value={sum.activeSubscriptions} />
              <Stat size="sm" label="Packs sold" value={sum.packsSoldAllTime} hint={`${sum.packsSold30d} in 30d`} />
              <Stat size="sm" label="Checkout revenue 30d" value={formatUsd(sum.revenue30dCents / 100)} />
              <Stat size="sm" label="Unused credits" value={sum.creditsOutstanding} />
            </div>
            {sum.byVariant.length > 0 && (
              <table className="mt-5 w-full text-left font-mono text-xs">
                <thead className="text-ink-3">
                  <tr>
                    <th className="py-1 font-semibold">Variant (30d)</th>
                    <th className="py-1 text-right font-semibold">Buys</th>
                    <th className="py-1 text-right font-semibold">Pro</th>
                    <th className="py-1 text-right font-semibold">Pack</th>
                    <th className="py-1 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {sum.byVariant.map((v) => (
                    <tr key={v.variant} className="border-t border-line">
                      <td className="py-1">{v.variant === "none" ? "test off" : v.variant}</td>
                      <td className="py-1 text-right">{v.purchases}</td>
                      <td className="py-1 text-right">{v.pro}</td>
                      <td className="py-1 text-right">{v.pack}</td>
                      <td className="py-1 text-right">{formatUsd(v.revenueCents / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-3">No numbers yet.</p>
        )}
      </Card>
    </div>
  );
}
