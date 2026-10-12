"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, LogOut, RefreshCw } from "lucide-react";
import type { AnalyticsStats } from "@/lib/analytics/types";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, Eyebrow } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { BillingPanel } from "@/components/billing";
import { AdminError, adminJson, loadToken, saveToken } from "./api";
import { DailyChart, FunnelCard, GateCard, ReferrersCard, VerdictsCard } from "./StatsSections";
import { PredictionsAdmin } from "./PredictionsAdmin";
import { WaitlistAdmin } from "./WaitlistAdmin";

export function AdminDashboard() {
  // null until sessionStorage has been read on the client.
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setToken(loadToken());
  }, []);

  const signOut = useCallback((why?: string) => {
    saveToken("");
    setToken("");
    setNotice(why ?? null);
  }, []);

  if (token === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!token) {
    return (
      <TokenGate
        notice={notice}
        onSubmit={(t) => {
          saveToken(t);
          setNotice(null);
          setToken(t);
        }}
      />
    );
  }
  return <Dashboard token={token} onSignOut={signOut} />;
}

function TokenGate({ onSubmit, notice }: { onSubmit: (token: string) => void; notice: string | null }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (t) onSubmit(t);
  };
  return (
    <Card className="mx-auto max-w-md" padding="lg">
      <Eyebrow>Internal</Eyebrow>
      <h1 className="mt-1 font-display text-xl font-bold uppercase leading-tight tracking-wide text-ink">Admin</h1>
      <CardDescription className="mt-1">
        Paste the ADMIN_TOKEN. It&apos;s kept in this tab&apos;s session storage only and cleared when the tab closes.
      </CardDescription>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <Field label="Admin token" error={notice ?? undefined}>
          <Input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} mono />
        </Field>
        <Button type="submit" iconLeft={<KeyRound className="size-4" aria-hidden />} disabled={!value.trim()}>
          Unlock
        </Button>
      </form>
    </Card>
  );
}

const DAY_OPTIONS = [7, 14, 21, 30, 60, 90].map((d) => ({ value: String(d), label: `Last ${d} days` }));

function Dashboard({ token, onSignOut }: { token: string; onSignOut: (why?: string) => void }) {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("tab") ?? "metrics";
    } catch {
      return "metrics";
    }
  });
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAuthError = useCallback(
    (err: unknown): boolean => {
      if (err instanceof AdminError && (err.status === 401 || err.status === 403)) {
        onSignOut(err.message);
        return true;
      }
      return false;
    },
    [onSignOut],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await adminJson<{ stats: AnalyticsStats }>(token, `/api/admin/stats?days=${days}`);
      setStats(j.stats);
    } catch (err) {
      if (!onAuthError(err)) setError(err instanceof Error ? err.message : "Couldn't load stats.");
    } finally {
      setLoading(false);
    }
  }, [token, days, onAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Internal · not indexed</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">Admin</h1>
          <p className="text-sm text-ink-3">
            {stats
              ? `Since ${stats.since} (UTC) · ${stats.totalVisits.toLocaleString()} visits · ${stats.totalEvents.toLocaleString()} events · updated ${new Date(stats.generatedAt).toLocaleTimeString()}`
              : "Anonymous, cookieless counts. Raw events are kept 90 days."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Select
              aria-label="Time window"
              selectSize="sm"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              options={DAY_OPTIONS}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            loading={loading}
            iconLeft={<RefreshCw className="size-4" aria-hidden />}
          >
            Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onSignOut()} iconLeft={<LogOut className="size-4" aria-hidden />}>
            Lock
          </Button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm font-semibold text-bad">
          {error}
        </p>
      ) : null}

      <Tabs
        label="Admin sections"
        variant="underline"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            id: "metrics",
            label: "Metrics",
            content: stats ? (
              <div className="flex flex-col gap-5">
                <GateCard stats={stats} />
                <div className="grid gap-5 lg:grid-cols-2">
                  <FunnelCard stats={stats} />
                  <VerdictsCard stats={stats} />
                </div>
                <DailyChart stats={stats} />
                <ReferrersCard stats={stats} />
              </div>
            ) : !error ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : null,
          },
          { id: "predictions", label: "Predictions", content: <PredictionsAdmin token={token} onAuthError={onAuthError} /> },
          {
            id: "waitlist",
            label: "Waitlist",
            content: <WaitlistAdmin token={token} onAuthError={onAuthError} stats={stats} onChanged={() => void load()} />,
          },
          { id: "billing", label: "Billing", content: <BillingPanel adminToken={token} /> },
        ]}
      />
    </div>
  );
}
