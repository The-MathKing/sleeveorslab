"use client";
import clsx from "clsx";
import { ClipboardList, Download, Layers, Plus, RefreshCw, Share2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import { evaluateAllGraders } from "@/lib/ev";
import { getTiers } from "@/lib/grading";
import { loadBinder, newId, saveBinder, type BinderEntry } from "@/lib/store";
import type { CardRef, EVResult, PriceQuote } from "@/lib/types";
import { CardSearch } from "./CardSearch";
import { fetchPrice, searchCards, shareImage, shareUrl, usd, pool } from "./format";
import { Btn, CardThumb, EmptyState, Money, Panel, Segmented, Skeleton } from "./parts";
import { VerdictBadge } from "./VerdictBadge";
import { UpgradePanel, useEntitlement } from "@/components/billing";

/** Binder triage is a paid feature past this many cards (soft: results still show). */
export const FREE_BINDER_CARDS = 10;
const CHARGED_KEY = "sos:binder-charged";

function loadCharged(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHARGED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveCharged(keys: Set<string>) {
  try {
    localStorage.setItem(CHARGED_KEY, JSON.stringify([...keys].slice(-2000)));
  } catch {
    /* storage unavailable */
  }
}

const CONCURRENCY = 3;
const MAX_ENTRIES = 300;

type PriceState = { state: "loading" } | { state: "ok"; price: PriceQuote } | { state: "error"; error: string };

interface Row {
  entry: BinderEntry;
  price?: PriceState;
  result?: EVResult;
  evalError?: string;
}

const CONDITION_OPTS: { v: string; label: string }[] = [
  { v: "", label: "Cond. —" },
  { v: "5", label: "Pack fresh" },
  { v: "4", label: "NM, minor" },
  { v: "3", label: "Light wear" },
  { v: "2", label: "Worn" },
];

export function Binder() {
  const [entries, setEntries] = useState<BinderEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prices, setPrices] = useState<Record<string, PriceState>>({});
  const [mode, setMode] = useState<"search" | "paste">("search");
  const [paste, setPaste] = useState("");
  const [pasteBusy, setPasteBusy] = useState<{ done: number; total: number } | null>(null);
  const [pasteMisses, setPasteMisses] = useState<string[]>([]);
  const [flash, setFlash] = useState("");

  // Load persisted binder.
  useEffect(() => {
    let alive = true;
    loadBinder().then((e) => {
      if (!alive) return;
      setEntries(e);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist on change (after initial load).
  useEffect(() => {
    if (loaded) void saveBinder(entries);
  }, [entries, loaded]);

  /* ----- price queue (global concurrency cap) ----- */
  const queue = useRef<string[]>([]);
  const active = useRef(0);
  const queued = useRef(new Set<string>());

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      active.current++;
      fetchPrice(id)
        .then((price) => setPrices((p) => ({ ...p, [id]: { state: "ok", price } })))
        .catch((e) => setPrices((p) => ({ ...p, [id]: { state: "error", error: e instanceof Error ? e.message : "failed" } })))
        .finally(() => {
          active.current--;
          queued.current.delete(id);
          pump();
        });
    }
  }, []);

  useEffect(() => {
    const need = Array.from(new Set(entries.map((e) => e.card.id))).filter((id) => !prices[id] && !queued.current.has(id));
    if (!need.length) return;
    need.forEach((id) => queued.current.add(id));
    queue.current.push(...need);
    setPrices((p) => ({ ...p, ...Object.fromEntries(need.map((id) => [id, { state: "loading" } as PriceState])) }));
    pump();
  }, [entries, prices, pump]);

  const retry = (id: string) =>
    setPrices((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });

  /* ----- adding ----- */
  const ids = useMemo(() => new Set(entries.map((e) => e.card.id)), [entries]);

  const addCard = useCallback((card: CardRef, condition?: number) => {
    setEntries((list) => {
      if (list.some((e) => e.card.id === card.id) || list.length >= MAX_ENTRIES) return list;
      return [...list, { key: newId("b"), card, condition, addedAt: new Date().toISOString() }];
    });
  }, []);

  const addPasted = async () => {
    const lines = paste
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (!lines.length) return;
    setPasteBusy({ done: 0, total: lines.length });
    setPasteMisses([]);
    const misses: string[] = [];
    let done = 0;
    let added = 0;
    await pool(lines, CONCURRENCY, async (line) => {
      try {
        const [hit] = await searchCards(line, 1);
        if (hit) {
          addCard(hit);
          added++;
        } else misses.push(line);
      } catch {
        misses.push(line);
      }
      done++;
      setPasteBusy({ done, total: lines.length });
    });
    setPasteBusy(null);
    setPasteMisses(misses);
    setPaste(misses.join("\n"));
    setFlash(`Added ${added} card${added === 1 ? "" : "s"}${misses.length ? `; ${misses.length} didn't match (left in the box)` : ""}.`);
  };

  const setCondition = (key: string, c: number | undefined) =>
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, condition: c } : e)));
  const remove = (key: string) => setEntries((list) => list.filter((e) => e.key !== key));

  /* ----- evaluation ----- */
  const rows: Row[] = useMemo(() => {
    const out = entries.map<Row>((entry) => {
      const p = prices[entry.card.id];
      if (!p || p.state !== "ok") return { entry, price: p };
      try {
        const { best } = evaluateAllGraders({ card: entry.card, price: p.price, conditionSelfRating: entry.condition });
        return { entry, price: p, result: best };
      } catch (e) {
        return { entry, price: p, evalError: e instanceof Error ? e.message : "engine error" };
      }
    });
    return out.sort((a, b) => {
      const av = a.result?.expectedProfitUsd ?? -Infinity;
      const bv = b.result?.expectedProfitUsd ?? -Infinity;
      return bv - av;
    });
  }, [entries, prices]);

  const totals = useMemo(() => {
    const t = { SLAB: 0, SLEEVE: 0, BORDERLINE: 0, pending: 0, wasted: 0, slabProfit: 0, everythingProfit: 0, sleeveCount: 0 };
    for (const r of rows) {
      if (!r.result) {
        t.pending++;
        continue;
      }
      t[r.result.verdict]++;
      t.everythingProfit += r.result.expectedProfitUsd;
      if (r.result.verdict === "SLEEVE") {
        t.wasted += r.result.totalCostUsd;
        t.sleeveCount++;
      }
      if (r.result.verdict === "SLAB") t.slabProfit += r.result.expectedProfitUsd;
    }
    return t;
  }, [rows]);

  const bulkTier = useMemo(() => {
    try {
      return getTiers("CGC").find((t) => t.available && (t.minCards ?? 0) >= 2) ?? null;
    } catch {
      return null;
    }
  }, []);

  const exportCsv = () => {
    const header = ["rank", "name", "number", "set", "card_id", "condition", "verdict", "grader", "tier", "fee_usd", "raw_usd", "expected_graded_usd", "expected_profit_usd", "p_loss", "p10", "confidence"];
    const esc = (v: unknown) => {
      const s = v === undefined || v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r, i) => {
      const x = r.result;
      return [
        i + 1,
        r.entry.card.name,
        r.entry.card.number,
        r.entry.card.setName,
        r.entry.card.id,
        r.entry.condition ?? "",
        x?.verdict ?? "",
        x?.grader ?? "",
        x?.tier.name ?? "",
        x?.tier.feeUsd ?? "",
        x?.rawValueUsd.toFixed(2) ?? "",
        x?.expectedGradedValueUsd.toFixed(2) ?? "",
        x?.expectedProfitUsd.toFixed(2) ?? "",
        x?.probabilityOfLoss.toFixed(3) ?? "",
        x ? (x.distribution[10] ?? 0).toFixed(3) : "",
        x?.confidence ?? "",
      ]
        .map(esc)
        .join(",");
    });
    try {
      const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sleeve-or-slab-binder-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setFlash("Couldn't build the CSV in this browser.");
    }
  };

  const share = async () => {
    track("share_clicked");
    const url = shareUrl({ saved: totals.wasted, cards: totals.sleeveCount });
    const how = await shareImage(url, `${totals.sleeveCount} cards sleeved, ${usd(totals.wasted)} in grading fees not wasted. sleeveorslab.com`);
    if (how === "opened") setFlash("Opened the share image in a new tab.");
  };

  const evaluated = rows.length - totals.pending;

  // Count a binder evaluation once all prices are in, and again only if the card count changes.
  const reportedCards = useRef(0);
  useEffect(() => {
    if (totals.pending || !evaluated || evaluated === reportedCards.current) return;
    reportedCards.current = evaluated;
    track("binder_evaluated", { cards: evaluated });
  }, [evaluated, totals.pending]);

  // Paid past FREE_BINDER_CARDS: Pro is unlimited; a pack spends one credit per extra card, once
  // (charged card keys are remembered so a reload doesn't charge again); otherwise show the upgrade.
  const ent = useEntitlement();
  const [overLimit, setOverLimit] = useState(false);
  const charging = useRef(false);
  const { consume, isPro, hasToken, loading: entLoading } = ent;
  useEffect(() => {
    const extra = entries.slice(FREE_BINDER_CARDS);
    if (!extra.length || isPro) {
      setOverLimit(false);
      return;
    }
    if (entLoading || charging.current) return;
    const charged = loadCharged();
    const uncharged = extra.filter((e) => !charged.has(e.key));
    if (!uncharged.length) {
      setOverLimit(false);
      return;
    }
    if (!hasToken) {
      setOverLimit(true);
      return;
    }
    charging.current = true;
    void consume(uncharged.length)
      .then((r) => {
        if (r.ok) {
          uncharged.forEach((e) => charged.add(e.key));
          saveCharged(charged);
        }
        setOverLimit(!r.ok);
      })
      .finally(() => {
        charging.current = false;
      });
  }, [entries, isPro, hasToken, entLoading, consume]);

  return (
    <div className="flex flex-col gap-5">
      {/* Add */}
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Add cards</h2>
          <Segmented
            label="Add mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "search", label: "Search" },
              { value: "paste", label: "Paste a list" },
            ]}
          />
        </div>
        {mode === "search" ? (
          <CardSearch layout="list" actionLabel="Add" pickedIds={ids} onPick={(c) => addCard(c)} />
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="binder-paste" className="text-sm text-ink-2">
              One card per line. Name, number, and set code work best.
            </label>
            <textarea
              id="binder-paste"
              rows={6}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"charizard 199 sv3pt5\npikachu 25/102\numbreon vmax 215"}
              className="w-full rounded-xl border border-line bg-card p-3 font-mono text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-ink"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="primary" onClick={addPasted} loading={!!pasteBusy} disabled={!paste.trim()}>
                <ClipboardList className="size-4" aria-hidden />
                {pasteBusy ? `Matching ${pasteBusy.done}/${pasteBusy.total}` : "Match & add"}
              </Btn>
              {pasteMisses.length ? <span className="text-sm text-ink-3">{pasteMisses.length} unmatched; edit and retry.</span> : null}
            </div>
          </div>
        )}
        {flash ? (
          <p className="mt-2 text-sm text-ink-2" role="status">
            {flash}
          </p>
        ) : null}
      </Panel>

      {!loaded ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-8" aria-hidden />}
          title="Your binder is empty"
          body="Add the cards you're thinking about grading. We'll rank them and tell you which few are worth the fee (usually not many)."
          action={
            <Btn variant="primary" onClick={() => setMode("paste")}>
              <Plus className="size-4" aria-hidden /> Paste a list
            </Btn>
          }
        />
      ) : (
        <>
          {overLimit ? <UpgradePanel source="binder" context="binder" /> : null}
          {/* Totals */}
          <Panel className="p-4">
            <p className="font-mono text-lg font-bold tabular-nums sm:text-xl">
              <span className="text-sleeve-ink">Sleeve {totals.SLEEVE}</span>
              <span className="px-2 text-ink-3">·</span>
              <span className="text-slab-ink">Slab {totals.SLAB}</span>
              <span className="px-2 text-ink-3">·</span>
              <span>Borderline {totals.BORDERLINE}</span>
            </p>
            {totals.pending ? (
              <p className="mt-1 text-xs text-ink-3" role="status">
                Pricing {evaluated}/{rows.length}…
              </p>
            ) : null}
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-paper p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Fees you&apos;d waste grading everything</dt>
                <dd className="mt-1">
                  <Money value={totals.wasted} className="text-2xl font-bold text-bad" />
                </dd>
                <dd className="text-xs text-ink-3">Grading + shipping on the {totals.SLEEVE} Sleeve cards</dd>
              </div>
              <div className="rounded-xl bg-paper p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Expected profit grading only the Slabs</dt>
                <dd className="mt-1">
                  <Money value={totals.slabProfit} sign className="text-2xl font-bold" />
                </dd>
                <dd className="text-xs text-ink-3">
                  vs <span className="font-mono">{usd(totals.everythingProfit, { sign: true })}</span> grading all {evaluated}
                </dd>
              </div>
            </dl>
            {totals.SLAB >= 25 ? (
              <p className="mt-3 rounded-xl border border-slab/40 bg-slab-soft px-3 py-2 text-sm text-slab-ink">
                {totals.SLAB} slab-worthy cards. That clears the {bulkTier ? `${bulkTier.name} (min ${bulkTier.minCards})` : "CGC bulk"}{" "}
                minimum; a bulk submission could cut the per-card fee. Check the tier picker on each card&apos;s verdict.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" onClick={exportCsv} disabled={!evaluated}>
                <Download className="size-4" aria-hidden /> Export CSV
              </Btn>
              <Btn size="sm" onClick={share} disabled={!totals.sleeveCount}>
                <Share2 className="size-4" aria-hidden /> Share &ldquo;I saved {usd(totals.wasted)}&rdquo;
              </Btn>
              <Btn
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm(`Remove all ${entries.length} cards from the binder?`)) setEntries([]);
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Clear
              </Btn>
            </div>
          </Panel>

          {/* Ranked list */}
          <ol className="flex flex-col gap-2" aria-label="Cards ranked by expected profit">
            {rows.map((r, i) => (
              <BinderRow key={r.entry.key} row={r} rank={i + 1} onCondition={setCondition} onRemove={remove} onRetry={retry} />
            ))}
          </ol>
          <p className="text-xs text-ink-3">
            Batch verdicts use market prices, no photo (typical centering assumed) and your quick condition pick. For the full
            breakdown, scan the card individually.
          </p>
        </>
      )}
    </div>
  );
}

function BinderRow({
  row,
  rank,
  onCondition,
  onRemove,
  onRetry,
}: {
  row: Row;
  rank: number;
  onCondition: (key: string, c: number | undefined) => void;
  onRemove: (key: string) => void;
  onRetry: (cardId: string) => void;
}) {
  const { entry, result, price } = row;
  return (
    <li className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-card p-2 sm:gap-3 sm:p-3">
      <span className="w-6 shrink-0 text-center font-mono text-xs text-ink-3">{result ? rank : "·"}</span>
      <CardThumb src={entry.card.imageSmall} alt="" className="w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.card.name}</p>
        <p className="truncate font-mono text-[11px] text-ink-3">
          {entry.card.number} · {entry.card.setName}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <label className="sr-only" htmlFor={`cond-${entry.key}`}>
            Condition for {entry.card.name}
          </label>
          <select
            id={`cond-${entry.key}`}
            value={entry.condition === undefined ? "" : String(entry.condition)}
            onChange={(e) => onCondition(entry.key, e.target.value ? Number(e.target.value) : undefined)}
            className="min-h-8 rounded-lg border border-line bg-paper px-1.5 text-xs text-ink"
          >
            {CONDITION_OPTS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
          {result ? <span className="hidden truncate font-mono text-[11px] text-ink-3 sm:inline">{result.tier.name}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {result ? (
          <>
            <VerdictBadge verdict={result.verdict} size="sm" />
            <Money value={result.expectedProfitUsd} sign className="text-sm font-semibold" />
          </>
        ) : price?.state === "error" || row.evalError ? (
          <button type="button" onClick={() => onRetry(entry.card.id)} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-bad">
            <RefreshCw className="size-3.5" aria-hidden /> Retry
          </button>
        ) : (
          <>
            <span className={clsx("h-5 w-16 animate-pulse rounded bg-paper-2")} />
            <span className="h-4 w-12 animate-pulse rounded bg-paper-2" />
          </>
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove ${entry.card.name}`}
        onClick={() => onRemove(entry.key)}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-2 hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}
