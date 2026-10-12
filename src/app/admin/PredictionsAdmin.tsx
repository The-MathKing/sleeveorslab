"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { RefreshCw, Trash2 } from "lucide-react";
import type { Prediction } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { adminJson } from "./api";

const GRADE_OPTIONS = [{ value: "", label: "Grade" }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(10 - i), label: String(10 - i) }))];
const verdictTone = { SLAB: "slab", SLEEVE: "sleeve", BORDERLINE: "borderline" } as const;

export function PredictionsAdmin({ token, onAuthError }: { token: string; onAuthError: (err: unknown) => boolean }) {
  const [items, setItems] = useState<Prediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await adminJson<{ predictions: Prediction[] }>(token, "/api/admin/predictions?limit=500");
      setItems(j.predictions);
    } catch (err) {
      if (!onAuthError(err)) setError(err instanceof Error ? err.message : "Couldn't load predictions.");
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (p: Prediction) => setItems((list) => list?.map((x) => (x.id === p.id ? p : x)) ?? null);
  const remove = (id: string) => setItems((list) => list?.filter((x) => x.id !== id) ?? null);

  const shown = (items ?? []).filter((p) => (filter === "all" ? true : filter === "open" ? !p.outcome : !!p.outcome));
  const resolved = items?.filter((p) => p.outcome).length ?? 0;

  return (
    <Card as="section" aria-labelledby="preds-title">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle as="h2" id="preds-title">
            Predictions
          </CardTitle>
          <CardDescription>
            Public and private. {items ? `${items.length} total, ${resolved} with a verified grade.` : ""}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select
              aria-label="Filter predictions"
              selectSize="sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              options={[
                { value: "open", label: "Awaiting grade" },
                { value: "resolved", label: "Graded" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} loading={loading} iconLeft={<RefreshCw className="size-4" aria-hidden />}>
            Reload
          </Button>
        </div>
      </CardHeader>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      ) : null}
      {items && shown.length === 0 ? <p className="text-sm text-ink-3">Nothing here.</p> : null}
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((p) => (
          <PredictionRow key={p.id} p={p} token={token} onAuthError={onAuthError} onUpdated={replace} onDeleted={remove} />
        ))}
      </ul>
    </Card>
  );
}

function PredictionRow({
  p,
  token,
  onAuthError,
  onUpdated,
  onDeleted,
}: {
  p: Prediction;
  token: string;
  onAuthError: (err: unknown) => boolean;
  onUpdated: (p: Prediction) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [grade, setGrade] = useState("");
  const [cert, setCert] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const p10 = p.distribution[10];

  const fail = (err: unknown, what: string) => {
    if (!onAuthError(err)) toast({ tone: "bad", title: what, description: err instanceof Error ? err.message : undefined });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!grade) return;
    setBusy("save");
    try {
      const body: { grade: number; certNumber?: string } = { grade: Number(grade) };
      if (cert.trim()) body.certNumber = cert.trim();
      const j = await adminJson<{ prediction: Prediction }>(token, `/api/predictions/${encodeURIComponent(p.id)}/outcome`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onUpdated(j.prediction);
      toast({ tone: "good", title: `${p.id}: recorded ${p.grader} ${grade}` });
    } catch (err) {
      fail(err, "Couldn't record the grade");
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    if (!window.confirm(`Delete ${p.id} (${p.card.name}) permanently? This can't be undone.`)) return;
    setBusy("delete");
    try {
      const j = await adminJson<{ deleted: boolean }>(token, "/api/admin/delete", {
        method: "POST",
        body: JSON.stringify({ predictionId: p.id }),
      });
      onDeleted(p.id);
      toast({ tone: j.deleted ? "good" : "neutral", title: j.deleted ? `Deleted ${p.id}` : `${p.id} was already gone` });
    } catch (err) {
      fail(err, "Couldn't delete");
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/receipts/${p.id}`} className="font-mono text-sm font-semibold text-ink underline-offset-4 hover:underline">
            {p.id}
          </Link>
          <Badge tone={verdictTone[p.verdict]}>{p.verdict}</Badge>
          {!p.isPublic ? <Badge>private</Badge> : null}
          {p.intendsToSubmit ? <Badge tone="ink">submitting</Badge> : null}
        </div>
        <p className="truncate text-sm text-ink">
          {p.card.name} <span className="font-mono text-xs text-ink-3">#{p.card.number} · {p.card.setName}</span>
        </p>
        <p className="font-mono text-xs text-ink-3">
          {p.grader} {p.tierId} · P(10) {p10 !== undefined ? `${Math.round(p10 * 100)}%` : "–"} ·{" "}
          {new Date(p.createdAt).toISOString().slice(0, 10)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {p.outcome ? (
          <Badge tone="good" size="md">
            {p.grader} {p.outcome.grade}
            {p.outcome.certNumber ? ` · #${p.outcome.certNumber}` : ""}
          </Badge>
        ) : (
          <form onSubmit={save} className="flex items-center gap-2">
            <div className="w-24">
              <Select aria-label={`Verified grade for ${p.id}`} selectSize="sm" value={grade} onChange={(e) => setGrade(e.target.value)} options={GRADE_OPTIONS} />
            </div>
            <Input
              aria-label={`Cert number for ${p.id}`}
              inputSize="sm"
              mono
              placeholder="Cert #"
              value={cert}
              maxLength={24}
              onChange={(e) => setCert(e.target.value)}
              className="w-28"
            />
            <Button type="submit" size="sm" disabled={!grade} loading={busy === "save"}>
              Record
            </Button>
          </form>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={del}
          loading={busy === "delete"}
          aria-label={`Delete ${p.id}`}
          className="text-bad"
          iconLeft={<Trash2 className="size-4" aria-hidden />}
        >
          <span className="sm:sr-only">Delete</span>
        </Button>
      </div>
    </li>
  );
}
