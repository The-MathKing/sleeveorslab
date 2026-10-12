"use client";

import { useState, type FormEvent } from "react";
import { Download, Trash2 } from "lucide-react";
import type { AnalyticsStats } from "@/lib/analytics/types";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { adminFetch, adminJson } from "./api";

export function WaitlistAdmin({
  token,
  onAuthError,
  stats,
  onChanged,
}: {
  token: string;
  onAuthError: (err: unknown) => boolean;
  stats: AnalyticsStats | null;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"delete" | "csv" | null>(null);

  const fail = (err: unknown, what: string) => {
    if (!onAuthError(err)) toast({ tone: "bad", title: what, description: err instanceof Error ? err.message : undefined });
  };

  const del = async (e: FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    if (!target) return;
    if (!window.confirm(`Delete ${target} from the waitlist permanently?`)) return;
    setBusy("delete");
    try {
      const j = await adminJson<{ deleted: boolean }>(token, "/api/admin/delete", {
        method: "POST",
        body: JSON.stringify({ email: target }),
      });
      toast(j.deleted ? { tone: "good", title: "Deleted from the waitlist" } : { tone: "neutral", title: "No signup with that email" });
      if (j.deleted) {
        setEmail("");
        onChanged();
      }
    } catch (err) {
      fail(err, "Couldn't delete");
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy("csv");
    try {
      const res = await adminFetch(token, "/api/admin/waitlist?format=csv");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waitlist-marketing-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      fail(err, "Couldn't export");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card as="section" aria-labelledby="wl-title">
      <CardHeader>
        <CardTitle as="h2" id="wl-title">
          Waitlist
        </CardTitle>
        <CardDescription>
          {stats ? `${stats.waitlist.total.toLocaleString()} signups, ${stats.waitlist.consenting.toLocaleString()} opted in to marketing email. ` : ""}
          The export only includes people who opted in.
        </CardDescription>
      </CardHeader>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">Export</p>
          <Button variant="outline" onClick={exportCsv} loading={busy === "csv"} iconLeft={<Download className="size-4" aria-hidden />}>
            Download CSV (opted in)
          </Button>
          <p className="text-xs text-ink-3">email, created_at, source. Handle it like the personal data it is.</p>
        </div>
        <form onSubmit={del} className="flex flex-col gap-2">
          <Field label="Deletion request" hint="Removes the signup permanently. Case doesn't matter.">
            <Input type="email" autoComplete="off" placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="outline" disabled={!email.trim()} loading={busy === "delete"} iconLeft={<Trash2 className="size-4" aria-hidden />}>
            Delete email
          </Button>
        </form>
      </div>
    </Card>
  );
}
