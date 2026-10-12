"use client";
import Link from "next/link";
import { BookOpen, RefreshCw, ScanLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRatio } from "@/lib/centering";
import { listCollection, removeFromCollection, saveToCollection } from "@/lib/store";
import type { CollectionItem, Verdict } from "@/lib/types";
import { shortDate } from "./format";
import { Btn, CardThumb, EmptyState, Money, Segmented, Skeleton } from "./parts";
import { VerdictBadge } from "./VerdictBadge";

type Filter = "all" | Verdict;

function ratio(r: number) {
  try {
    return formatRatio(r);
  } catch {
    const b = Math.round(r * 100);
    return `${b}/${100 - b}`;
  }
}

export function Collection() {
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    listCollection().then((x) => alive && setItems(x));
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => (items ?? []).filter((i) => filter === "all" || i.lastResult?.verdict === filter), [items, filter]);

  if (!items) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<BookOpen className="size-8" aria-hidden />}
        title="Nothing saved yet"
        body="Scan a card and tap Save. It stays on this device: no account, nothing uploaded."
        action={
          <Link href="/scan" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-paper">
            <ScanLine className="size-4" aria-hidden /> Scan a card
          </Link>
        }
      />
    );
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this card from your device?")) return;
    await removeFromCollection(id);
    setItems((x) => (x ?? []).filter((i) => i.id !== id));
  };

  const saveNotes = async (item: CollectionItem, notes: string) => {
    if ((item.notes ?? "") === notes) return;
    const next = { ...item, notes: notes || undefined };
    setItems((x) => (x ?? []).map((i) => (i.id === item.id ? next : i)));
    try {
      await saveToCollection(next);
    } catch {
      /* stays in memory for this session */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-ink-2">
          {items.length} saved · on this device only
        </p>
        <Segmented
          label="Filter by verdict"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "SLAB", label: "Slab" },
            { value: "BORDERLINE", label: "Border" },
            { value: "SLEEVE", label: "Sleeve" },
          ]}
        />
      </div>
      {!shown.length ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">No cards with that verdict.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((item) => (
            <CollectionCard key={item.id} item={item} onDelete={() => remove(item.id)} onNotes={(n) => saveNotes(item, n)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CollectionCard({ item, onDelete, onNotes }: { item: CollectionItem; onDelete: () => void; onNotes: (n: string) => void }) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const r = item.lastResult;
  const f = item.centering?.front;
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius)] border border-line bg-card p-3">
      <div className="flex gap-3">
        {item.frontThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.frontThumb} alt={`Your photo of ${item.card.name}`} className="aspect-[63/88] w-16 shrink-0 rounded-md border border-line object-cover" />
        ) : (
          <CardThumb src={item.card.imageSmall} alt={item.card.name} className="w-16 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.card.name}</p>
          <p className="truncate font-mono text-[11px] text-ink-3">
            {item.card.number} · {item.card.setName}
          </p>
          {f ? (
            <p className="mt-1 font-mono text-xs text-ink-2">
              LR {ratio(f.leftRight)} · TB {ratio(f.topBottom)}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-ink-3">Saved {shortDate(item.savedAt)}</p>
        </div>
        {r ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <VerdictBadge verdict={r.verdict} size="sm" />
            <Money value={r.expectedProfitUsd} sign className="text-sm font-semibold" />
            <span className="font-mono text-[10px] text-ink-3">{r.tier.name}</span>
          </div>
        ) : null}
      </div>
      <label className="sr-only" htmlFor={`notes-${item.id}`}>
        Notes for {item.card.name}
      </label>
      <textarea
        id={`notes-${item.id}`}
        rows={2}
        value={notes}
        placeholder="Notes (where it is, what you paid…)"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onNotes(notes.trim())}
        className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-ink"
      />
      <div className="flex gap-2">
        <Link
          href={`/scan?rerun=${encodeURIComponent(item.id)}`}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-semibold hover:bg-paper-2"
        >
          <RefreshCw className="size-4" aria-hidden /> Re-run with fresh prices
        </Link>
        <Btn size="sm" variant="danger" onClick={onDelete} aria-label={`Delete ${item.card.name}`} className="min-h-10">
          <Trash2 className="size-4" aria-hidden />
        </Btn>
      </div>
    </li>
  );
}
