"use client";
import clsx from "clsx";
import Link from "next/link";
import { BookmarkPlus, Check, ChevronDown, Megaphone, RotateCcw, ScanLine, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPriceLadder, evaluate, evaluateAllGraders, resolveRaw } from "@/lib/ev";
import { eraOf, FEES_LAST_VERIFIED, gemRatePrior, getTiers } from "@/lib/grading";
import {
  countVerdict,
  FREE_VERDICTS_PER_DAY,
  hadVerdictThisSession,
  markVerdictThisSession,
  newId,
  saveToCollection,
  waitlistDismissed,
  waitlistJoined,
} from "@/lib/store";
import type { CardRef, CenteringResult, EVResult, Grade, GraderId, GradingTier, Prediction, PriceQuote } from "@/lib/types";
import { EmailCapture } from "./EmailCapture";
import { fetchPrice, pct, postPrediction, shareImage, shareUrl, shortDate, usd } from "./format";
import { Bar, Btn, CardThumb, ErrorNote, EstimateTag, FieldLabel, Money, Panel, Segmented, Skeleton, TextInput, UsdInput } from "./parts";
import { ratingLabel } from "./ConditionCheck";
import { VerdictStamp } from "@/components/brand/VerdictStamp";
import { VerdictBadge, verdictTone } from "./VerdictBadge";

const GRADERS: GraderId[] = ["PSA", "CGC"];
const GRADES_DESC: Grade[] = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

type GradedOverrides = Partial<Record<GraderId, Partial<Record<Grade, number>>>>;

export interface VerdictViewProps {
  card: CardRef;
  centering?: CenteringResult;
  conditionSelfRating?: number;
  frontThumb?: string;
  /** Re-running a saved collection item keeps its id + notes. */
  savedId?: string;
  notes?: string;
  onScanAnother?: () => void;
  /** Counts toward the free-tier soft limit (off when re-running from collection). */
  countsTowardLimit?: boolean;
}

export function VerdictView(props: VerdictViewProps) {
  const { card } = props;
  const [price, setPrice] = useState<PriceQuote | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setPrice(null);
    setPriceError(null);
    fetchPrice(card.id, ctrl.signal)
      .then((p) => setPrice(p))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setPriceError(e instanceof Error ? e.message : "Price lookup failed.");
      });
    return () => ctrl.abort();
  }, [card.id, nonce]);

  if (priceError && !price) {
    return (
      <div className="flex flex-col gap-4">
        <CardHeader card={card} thumb={props.frontThumb} />
        <ErrorNote onRetry={() => setNonce((n) => n + 1)}>
          Couldn&apos;t fetch prices ({priceError}). Retry, or enter prices yourself below.
        </ErrorNote>
        <Btn
          onClick={() =>
            setPrice({ cardId: card.id, graded: {}, source: "manual", asOf: new Date().toISOString(), gradedIsEstimate: false })
          }
        >
          Enter prices manually
        </Btn>
      </div>
    );
  }

  if (!price) return <VerdictSkeleton card={card} thumb={props.frontThumb} />;

  return <VerdictBody {...props} price={price} />;
}

function VerdictBody({
  card,
  centering,
  conditionSelfRating,
  frontThumb,
  savedId,
  notes,
  onScanAnother,
  countsTowardLimit = true,
  price,
}: VerdictViewProps & { price: PriceQuote }) {
  const [rawOverride, setRawOverride] = useState<number | undefined>(undefined);
  const [gradedOverride, setGradedOverride] = useState<GradedOverrides>({});
  const [gemOverridePct, setGemOverridePct] = useState<number | undefined>(undefined);
  const [choice, setChoice] = useState<{ grader: GraderId; tierId: string } | null>(null);

  const anyOverride = rawOverride !== undefined || gemOverridePct !== undefined || Object.values(gradedOverride).some((g) => g && Object.keys(g).length > 0);

  const effPrice = useMemo<PriceQuote>(() => {
    const graded: PriceQuote["graded"] = {};
    for (const g of GRADERS) {
      const merged = { ...(price.graded[g] ?? {}), ...(gradedOverride[g] ?? {}) };
      if (Object.keys(merged).length) graded[g] = merged;
    }
    return {
      ...price,
      raw: rawOverride ?? price.raw,
      graded,
      source: anyOverride ? "manual" : price.source,
    };
  }, [price, rawOverride, gradedOverride, anyOverride]);

  const baseInput = useMemo(
    () => ({
      card,
      price: effPrice,
      centering,
      conditionSelfRating,
      gemRateOverride: gemOverridePct !== undefined ? Math.max(0, Math.min(1, gemOverridePct / 100)) : undefined,
    }),
    [card, effPrice, centering, conditionSelfRating, gemOverridePct],
  );

  const computed = useMemo(() => {
    try {
      const all = evaluateAllGraders(baseInput);
      let selected: EVResult = all.best;
      if (choice) {
        const hit = all.all.find((r) => r.grader === choice.grader && r.tier.id === choice.tierId);
        if (hit) selected = hit;
        else {
          try {
            selected = evaluate({ ...baseInput, grader: choice.grader, tierId: choice.tierId });
          } catch {
            selected = all.best;
          }
        }
      }
      return { best: all.best, all: all.all, selected, error: null as string | null };
    } catch (e) {
      return { best: null, all: [] as EVResult[], selected: null, error: e instanceof Error ? e.message : "Engine error" };
    }
  }, [baseInput, choice]);

  // Count the verdict once per mount; decide on email capture / soft limit.
  const [gate, setGate] = useState<{ firstInSession: boolean; count: number } | null>(null);
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || !computed.best) return;
    counted.current = true;
    const firstInSession = !hadVerdictThisSession();
    markVerdictThisSession();
    const count = countsTowardLimit ? countVerdict() : 0;
    setGate({ firstInSession, count });
  }, [computed.best, countsTowardLimit]);

  if (computed.error || !computed.selected || !computed.best) {
    return (
      <div className="flex flex-col gap-4">
        <CardHeader card={card} thumb={frontThumb} />
        <ErrorNote>
          The verdict engine couldn&apos;t run ({computed.error ?? "no result"}). If you just deployed, give it a minute and
          reload.
        </ErrorNote>
      </div>
    );
  }

  const r = computed.selected;
  const best = computed.best;
  const isBest = r.grader === best.grader && r.tier.id === best.tier.id;

  return (
    <div className="flex flex-col gap-4">
      <CardHeader card={card} thumb={frontThumb} />

      {/* Verdict hero */}
      <Panel className={clsx("flex flex-col items-center gap-4 px-4 py-6 text-center", verdictTone(r.verdict).split(" ")[0])}>
        <VerdictStamp key={r.verdict} verdict={r.verdict} size="md" animate />
        <p className="max-w-md text-[15px] text-ink">{headline(r)}</p>
        <p className="font-mono text-xs text-ink-2">
          {r.grader} · {tierLabel(r.tier)}
          {isBest ? " · best option" : ""}
        </p>
      </Panel>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Expected profit" hint="vs selling raw">
          <Money value={r.expectedProfitUsd} sign className="text-2xl font-bold" />
        </StatBox>
        <StatBox label="Chance you lose money">
          <span className={clsx("font-mono text-2xl font-bold tabular-nums", r.probabilityOfLoss >= 0.5 ? "text-bad" : "text-ink")}>
            {pct(r.probabilityOfLoss)}
          </span>
        </StatBox>
        <StatBox label="Breakeven grade">
          <span className="font-mono text-lg font-bold">
            {r.breakEvenGrade ? `${r.grader} ${r.breakEvenGrade}+` : r.expectedProfitUsd < 0 ? "None" : "Any"}
          </span>
        </StatBox>
        <StatBox label="Confidence">
          <span className={clsx("font-mono text-lg font-bold uppercase", r.confidence === "low" ? "text-borderline" : r.confidence === "high" ? "text-good" : "text-ink")}>
            {r.confidence}
          </span>
        </StatBox>
      </div>
      {price.gradedIsEstimate ? (
        <p className="flex items-center gap-2 text-xs text-ink-2">
          <EstimateTag /> Graded prices for this card are estimates (multipliers on raw), not sales data. Override below if you
          know better.
        </p>
      ) : null}

      {/* Grader + tier */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Grade distribution</h2>
          <GraderTierPicker
            all={computed.all}
            grader={r.grader}
            tierId={r.tier.id}
            onChange={(grader, tierId) => setChoice({ grader, tierId })}
          />
        </div>
        <p className="mt-1 text-xs text-ink-3">PSA-style grade estimate. A probability range, not a promised grade.</p>
        <Distribution result={r} ladder={priceLadder(effPrice, r.grader, card)} isOverridden={(g) => gradedOverride[r.grader]?.[g] !== undefined} />
        {!isBest ? (
          <button type="button" onClick={() => setChoice(null)} className="mt-3 min-h-9 text-sm font-semibold text-ink-2 underline underline-offset-4">
            Back to best option ({best.grader} · {tierLabel(best.tier)})
          </button>
        ) : null}
      </Panel>

      {/* Reasons */}
      {r.reasons.length ? (
        <Panel className="p-4">
          <h2 className="font-display text-lg font-semibold">Why</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink">
            {r.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* Breakdown */}
      <Panel className="p-4">
        <h2 className="font-display text-lg font-semibold">The math</h2>
        <Breakdown r={r} />
      </Panel>

      {/* Comparison */}
      <Panel className="p-4">
        <h2 className="font-display text-lg font-semibold">PSA vs CGC</h2>
        <Comparison all={computed.all} selected={r} onPick={(g, t) => setChoice({ grader: g, tierId: t })} />
      </Panel>

      {/* Overrides */}
      <Overrides
        card={card}
        grader={r.grader}
        price={price}
        raw={rawOverride}
        setRaw={setRawOverride}
        graded={gradedOverride}
        setGraded={setGradedOverride}
        gemPct={gemOverridePct}
        setGemPct={setGemOverridePct}
        anyOverride={anyOverride}
        reset={() => {
          setRawOverride(undefined);
          setGradedOverride({});
          setGemOverridePct(undefined);
        }}
      />

      {/* Assumptions */}
      <details className="group rounded-[var(--radius)] border border-line bg-card p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-display text-lg font-semibold">
          Assumptions
          <ChevronDown className="size-5 transition group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
          {r.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>
            Condition self-check: {ratingLabel(conditionSelfRating)}
            {conditionSelfRating !== undefined ? ` (${conditionSelfRating}/5)` : ""}.
          </li>
          <li>
            Prices: {sourceLabel(effPrice.source)}, as of {shortDate(price.asOf)}.
          </li>
          <li>Fee table last verified {safeFeesDate()}.</li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          Estimates, not financial advice. Not affiliated with PSA, CGC, or The Pokémon Company.
        </p>
      </details>

      <Actions
        card={card}
        result={r}
        centering={centering}
        frontThumb={frontThumb}
        savedId={savedId}
        notes={notes}
        onScanAnother={onScanAnother}
      />

      {gate && gate.count > FREE_VERDICTS_PER_DAY && !waitlistJoined() ? (
        <EmailCapture
          source="soft-limit"
          tone="slab"
          dismissible={false}
          title="Pro is coming — join the waitlist"
          body={`That's ${gate.count} verdicts today. Free covers ${FREE_VERDICTS_PER_DAY} a day; keep going for now, it's on us. Pro adds unlimited scans, saved binders across devices, and price alerts.`}
        />
      ) : gate?.firstInSession && !waitlistJoined() && !waitlistDismissed() ? (
        <EmailCapture
          source="after-first-verdict"
          title="Want the verdict when prices move?"
          body="We'll email you when Pro launches: price alerts on your saved cards, bulk submission planning. No spam."
        />
      ) : null}
    </div>
  );
}

/* ---------------- pieces ---------------- */

function headline(r: EVResult): string {
  const p = usd(Math.abs(r.expectedProfitUsd));
  if (r.verdict === "SLAB") return `Grading with ${r.grader} should net about ${p} more than selling raw, on average. Not a sure thing: ${pct(r.probabilityOfLoss)} chance it loses money.`;
  if (r.verdict === "SLEEVE")
    return r.expectedProfitUsd < 0
      ? `Grading loses about ${p} on average. Keep it in the sleeve; that's ${usd(r.totalCostUsd)} you don't spend.`
      : `On paper it's +${p}, but the risk isn't worth the fees. Keep it in the sleeve.`;
  return `Roughly a coin flip: expected ${usd(r.expectedProfitUsd, { sign: true })}, ${pct(r.probabilityOfLoss)} chance of a loss. Grade only if you're confident in the surface.`;
}

/** Per-grade prices the engine actually uses (market where known, else labelled estimates). */
function priceLadder(price: PriceQuote, grader: GraderId, card: CardRef): { value: Partial<Record<Grade, number>>; estimated: (g: Grade) => boolean } {
  try {
    const raw = resolveRaw(price);
    const l = buildPriceLadder(price, grader, raw.raw, eraOf(card));
    return { value: l.value, estimated: (g) => l.source[g] !== "market" || price.gradedIsEstimate };
  } catch {
    const v = price.graded[grader] ?? {};
    return { value: v, estimated: () => price.gradedIsEstimate };
  }
}

function tierLabel(t: GradingTier): string {
  return t.name.toUpperCase().startsWith(t.grader) ? t.name.slice(t.grader.length).trim() || t.name : t.name;
}

function sourceLabel(s: PriceQuote["source"]): string {
  return s === "pricecharting" ? "PriceCharting" : s === "tcgplayer-via-pokemontcg" ? "TCGplayer (via pokemontcg.io)" : s === "manual" ? "your numbers" : "estimate";
}

function safeFeesDate(): string {
  try {
    return shortDate(FEES_LAST_VERIFIED);
  } catch {
    return "recently";
  }
}

function CardHeader({ card, thumb }: { card: CardRef; thumb?: string }) {
  return (
    <div className="flex items-center gap-3">
      <CardThumb src={card.imageSmall} alt={card.name} className="w-14 shrink-0 shadow-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-semibold">{card.name}</p>
        <p className="truncate font-mono text-xs text-ink-3">
          {card.number} · {card.setName}
          {card.rarity ? ` · ${card.rarity}` : ""}
        </p>
      </div>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="Your photo" className="h-16 w-12 shrink-0 rounded-md border border-line object-cover" />
      ) : null}
    </div>
  );
}

function VerdictSkeleton({ card, thumb }: { card: CardRef; thumb?: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <CardHeader card={card} thumb={thumb} />
      <Skeleton className="h-44 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-56 w-full" />
      <p className="text-center text-sm text-ink-3">Pulling prices and running the numbers…</p>
    </div>
  );
}

function StatBox({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <div className="mt-1">{children}</div>
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

function tiersFor(grader: GraderId, all: EVResult[]): GradingTier[] {
  try {
    const t = getTiers(grader).filter((x) => x.available);
    if (t.length) return t;
  } catch {
    /* engine not ready */
  }
  return all.filter((r) => r.grader === grader).map((r) => r.tier);
}

function GraderTierPicker({
  all,
  grader,
  tierId,
  onChange,
}: {
  all: EVResult[];
  grader: GraderId;
  tierId: string;
  onChange: (g: GraderId, tierId: string) => void;
}) {
  const tiers = tiersFor(grader, all);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Grader"
        value={grader}
        options={GRADERS.map((g) => ({ value: g, label: g }))}
        onChange={(g) => {
          const best = all.filter((r) => r.grader === g).sort((a, b) => b.expectedProfitUsd - a.expectedProfitUsd)[0];
          const t = best?.tier.id ?? tiersFor(g, all)[0]?.id;
          if (t) onChange(g, t);
        }}
      />
      <label className="sr-only" htmlFor="tier-select">
        Service tier
      </label>
      <select
        id="tier-select"
        value={tierId}
        onChange={(e) => onChange(grader, e.target.value)}
        className="min-h-11 max-w-[14rem] rounded-xl border border-line bg-card px-2 text-sm text-ink"
      >
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {usd(t.feeUsd)}
            {t.minCards ? ` (min ${t.minCards})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function Distribution({
  result,
  ladder,
  isOverridden,
}: {
  result: EVResult;
  ladder: ReturnType<typeof priceLadder>;
  isOverridden: (g: Grade) => boolean;
}) {
  const d = result.distribution;
  const top = GRADES_DESC.filter((g) => g >= 6);
  const low = GRADES_DESC.filter((g) => g < 6).reduce((s, g) => s + (d[g] ?? 0), 0);
  const prices = ladder.value;
  const mostLikely = GRADES_DESC.reduce((a, b) => ((d[b] ?? 0) > (d[a] ?? 0) ? b : a), 10 as Grade);
  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {top.map((g) => {
        const p = d[g] ?? 0;
        const pr = prices[g];
        const breakeven = result.breakEvenGrade !== undefined && g >= result.breakEvenGrade;
        return (
          <li key={g} className="grid grid-cols-[3.5rem_1fr_3.25rem] items-center gap-2 sm:grid-cols-[4rem_1fr_3.5rem_7rem]">
            <span className={clsx("font-mono text-sm font-semibold", g === mostLikely && "underline decoration-2 underline-offset-4")}>
              {result.grader} {g}
            </span>
            <Bar value={p} tone={breakeven ? (g === 10 ? "slab" : "ink") : "sleeve"} label={`${result.grader} ${g} probability`} />
            <span className="text-right font-mono text-sm tabular-nums">{pct(p, p > 0 && p < 0.1 ? 1 : 0)}</span>
            <span className="col-span-3 -mt-1 text-right font-mono text-xs text-ink-3 sm:col-span-1 sm:mt-0">
              {pr !== undefined ? usd(pr) : "no price"}
              {pr !== undefined && ladder.estimated(g) && !isOverridden(g) ? " est." : ""}
            </span>
          </li>
        );
      })}
      <li className="grid grid-cols-[3.5rem_1fr_3.25rem] items-center gap-2 sm:grid-cols-[4rem_1fr_3.5rem_7rem]">
        <span className="font-mono text-sm text-ink-2">≤ 5</span>
        <Bar value={low} tone="bad" label="Grade 5 or below probability" />
        <span className="text-right font-mono text-sm tabular-nums">{pct(low)}</span>
      </li>
      <li className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-slab" aria-hidden /> /
          <span className="inline-block h-2 w-3 rounded-sm bg-ink" aria-hidden /> grades that beat raw
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-sleeve" aria-hidden /> grades that lose
        </span>
        <span>underlined = most likely</span>
      </li>
    </ul>
  );
}

function Breakdown({ r }: { r: EVResult }) {
  const sum = r.breakdown.reduce((s, l) => s + l.amountUsd, 0);
  const reconciles = Math.abs(sum - r.expectedProfitUsd) < 0.02;
  return (
    <div className="mt-3 rounded-xl bg-paper p-3 font-mono text-sm">
      <ul className="flex flex-col gap-1.5">
        {r.breakdown.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="text-ink">{l.label}</span>
              {l.note ? <span className="block text-xs text-ink-3">{l.note}</span> : null}
            </span>
            <span className={clsx("shrink-0 tabular-nums", l.amountUsd < 0 ? "text-bad" : "text-ink")}>{usd(l.amountUsd, { sign: true })}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2 font-bold">
        <span>Expected profit vs raw</span>
        <Money value={r.expectedProfitUsd} sign />
      </div>
      <p className="mt-1 text-xs text-ink-3">
        {reconciles ? (
          <span className="inline-flex items-center gap-1 text-good">
            <Check className="size-3" aria-hidden /> Lines add up to the total.
          </span>
        ) : (
          <>Total costs {usd(r.totalCostUsd)} · expected slab value {usd(r.expectedGradedValueUsd)} · raw {usd(r.rawValueUsd)}</>
        )}
      </p>
    </div>
  );
}

function Comparison({ all, selected, onPick }: { all: EVResult[]; selected: EVResult; onPick: (g: GraderId, t: string) => void }) {
  const rows = [...all].sort((a, b) => b.expectedProfitUsd - a.expectedProfitUsd);
  if (!rows.length) return <p className="mt-2 text-sm text-ink-3">No tiers to compare.</p>;
  return (
    <div className="-mx-4 mt-3 overflow-x-auto px-4">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-3">
            <th className="py-1.5 pr-2 font-semibold">Service</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Fee</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Profit</th>
            <th className="py-1.5 pr-2 text-right font-semibold">P(loss)</th>
            <th className="py-1.5 font-semibold">
              <span className="sr-only">Verdict</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const on = r.grader === selected.grader && r.tier.id === selected.tier.id;
            return (
              <tr
                key={`${r.grader}-${r.tier.id}`}
                className={clsx("cursor-pointer border-t border-line", on && "bg-paper-2")}
                onClick={() => onPick(r.grader, r.tier.id)}
              >
                <td className="py-2 pr-2">
                  <button type="button" className="text-left font-semibold" onClick={() => onPick(r.grader, r.tier.id)}>
                    {r.grader} <span className="font-normal text-ink-2">{tierLabel(r.tier)}</span>
                  </button>
                </td>
                <td className="py-2 pr-2 text-right font-mono tabular-nums">{usd(r.tier.feeUsd)}</td>
                <td className="py-2 pr-2 text-right">
                  <Money value={r.expectedProfitUsd} sign />
                </td>
                <td className="py-2 pr-2 text-right font-mono tabular-nums">{pct(r.probabilityOfLoss)}</td>
                <td className="py-2 text-right">
                  <VerdictBadge verdict={r.verdict} size="sm" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Overrides({
  card,
  grader,
  price,
  raw,
  setRaw,
  graded,
  setGraded,
  gemPct,
  setGemPct,
  anyOverride,
  reset,
}: {
  card: CardRef;
  grader: GraderId;
  price: PriceQuote;
  raw: number | undefined;
  setRaw: (v: number | undefined) => void;
  graded: GradedOverrides;
  setGraded: (v: GradedOverrides) => void;
  gemPct: number | undefined;
  setGemPct: (v: number | undefined) => void;
  anyOverride: boolean;
  reset: () => void;
}) {
  const prior = useMemo(() => {
    try {
      return gemRatePrior(card, grader);
    } catch {
      return null;
    }
  }, [card, grader]);
  const setG = (g: GraderId, grade: Grade, v: number | undefined) => {
    const next: GradedOverrides = { ...graded, [g]: { ...(graded[g] ?? {}) } };
    if (v === undefined) delete next[g]![grade];
    else next[g]![grade] = v;
    setGraded(next);
  };
  const ph = (n: number | undefined) => (n === undefined ? "unknown" : n.toFixed(2));
  const ladders = { PSA: priceLadder(price, "PSA", card), CGC: priceLadder(price, "CGC", card) };
  return (
    <details className="group rounded-[var(--radius)] border border-line bg-card p-4" open={anyOverride || undefined}>
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between font-display text-lg font-semibold">
        <span>
          Your numbers {anyOverride ? <span className="ml-1 font-mono text-xs font-normal text-ink-3">(overridden)</span> : null}
        </span>
        <ChevronDown className="size-5 transition group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mt-1 text-sm text-ink-2">Know the comps better than we do? Type them in; everything recomputes live.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor="ov-raw">Raw (NM) price</FieldLabel>
          <UsdInput id="ov-raw" value={raw} onChange={setRaw} placeholder={ph(price.raw)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor="ov-gem">
            Gem rate, P(10) {prior ? <span className="normal-case">· prior {pct(prior.pGem)} est.</span> : null}
          </FieldLabel>
          <div className="relative">
            <TextInput
              id="ov-gem"
              inputMode="decimal"
              className="pr-8 font-mono"
              placeholder={prior ? (prior.pGem * 100).toFixed(0) : "auto"}
              value={gemPct === undefined ? "" : String(gemPct)}
              onChange={(e) => {
                const t = e.target.value.replace(/[^0-9.]/g, "");
                if (t === "") return setGemPct(undefined);
                const n = Number(t);
                if (Number.isFinite(n)) setGemPct(Math.min(100, n));
              }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-ink-3">%</span>
          </div>
          {prior ? <p className="mt-1 text-xs text-ink-3">{prior.basis}</p> : null}
        </div>
        {GRADERS.flatMap((g) =>
          ([10, 9] as Grade[]).map((grade) => (
            <div key={`${g}${grade}`}>
              <FieldLabel htmlFor={`ov-${g}-${grade}`}>
                {g} {grade}
                {ladders[g].estimated(grade) && graded[g]?.[grade] === undefined ? <span className="normal-case"> · est.</span> : null}
              </FieldLabel>
              <UsdInput id={`ov-${g}-${grade}`} value={graded[g]?.[grade]} onChange={(v) => setG(g, grade, v)} placeholder={ph(ladders[g].value[grade])} />
            </div>
          )),
        )}
      </div>
      {anyOverride ? (
        <Btn size="sm" variant="ghost" className="mt-3" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden /> Reset to market data
        </Btn>
      ) : null}
    </details>
  );
}

function Actions({
  card,
  result,
  centering,
  frontThumb,
  savedId,
  notes,
  onScanAnother,
}: {
  card: CardRef;
  result: EVResult;
  centering?: CenteringResult;
  frontThumb?: string;
  savedId?: string;
  notes?: string;
  onScanAnother?: () => void;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [logOpen, setLogOpen] = useState(false);
  const [intends, setIntends] = useState(false);
  const [logState, setLogState] = useState<"idle" | "sending" | "error">("idle");
  const [logErr, setLogErr] = useState("");
  const [logged, setLogged] = useState<Prediction | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const idRef = useRef(savedId ?? newId("card"));

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      await saveToCollection({
        id: idRef.current,
        savedAt: new Date().toISOString(),
        card,
        centering,
        lastResult: result,
        frontThumb,
        notes,
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [card, centering, result, frontThumb, notes]);

  const log = async () => {
    setLogState("sending");
    try {
      const p = await postPrediction({
        card,
        grader: result.grader,
        tierId: result.tier.id,
        verdict: result.verdict,
        distribution: result.distribution,
        expectedProfitUsd: result.expectedProfitUsd,
        intendsToSubmit: intends,
        isPublic: true,
      });
      setLogged(p);
      setLogState("idle");
    } catch (e) {
      setLogState("error");
      setLogErr(e instanceof Error ? e.message : "Couldn't log it.");
    }
  };

  const share = async () => {
    const saved = result.verdict === "SLEEVE" ? result.totalCostUsd : Math.max(0, result.expectedProfitUsd);
    const url = shareUrl({ saved, cards: 1, verdict: result.verdict, name: card.name });
    const text =
      result.verdict === "SLEEVE"
        ? `${card.name}: SLEEVE. Saved ${usd(result.totalCostUsd)} in grading fees. sleeveorslab.com`
        : `${card.name}: ${result.verdict}. sleeveorslab.com`;
    const how = await shareImage(url, text);
    setShareMsg(how === "opened" ? "Opened the share image in a new tab." : how === "shared" ? "Shared." : "");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="primary" size="lg" onClick={save} loading={saveState === "saving"} disabled={saveState === "saved"}>
          {saveState === "saved" ? <Check className="size-5" aria-hidden /> : <BookmarkPlus className="size-5" aria-hidden />}
          {saveState === "saved" ? "Saved" : savedId ? "Update saved" : "Save"}
        </Btn>
        <Btn size="lg" onClick={share}>
          <Share2 className="size-5" aria-hidden /> Share
        </Btn>
        <Btn size="lg" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen} disabled={!!logged}>
          <Megaphone className="size-5" aria-hidden /> {logged ? "Logged" : "Log publicly"}
        </Btn>
        {onScanAnother ? (
          <Btn size="lg" onClick={onScanAnother}>
            <ScanLine className="size-5" aria-hidden /> Scan another
          </Btn>
        ) : (
          <Link href="/scan" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-line bg-card px-5 font-semibold hover:bg-paper-2">
            <ScanLine className="size-5" aria-hidden /> Scan a card
          </Link>
        )}
      </div>
      {saveState === "saved" ? (
        <p className="text-sm text-ink-2" role="status">
          Saved on this device. <Link className="font-semibold underline underline-offset-4" href="/collection">View collection</Link>
        </p>
      ) : saveState === "error" ? (
        <p className="text-sm text-bad" role="alert">
          This browser blocked on-device storage (private mode?). Nothing was saved.
        </p>
      ) : null}
      {shareMsg ? <p className="text-sm text-ink-2" role="status">{shareMsg}</p> : null}

      {logOpen && !logged ? (
        <Panel className="p-4">
          <h3 className="font-display text-base font-semibold">Log this prediction publicly</h3>
          <p className="mt-1 text-sm text-ink-2">
            We publish predictions <em>before</em> the grade comes back, so anyone can check our hit rate. This posts:
          </p>
          <ul className="mt-2 list-disc pl-5 font-mono text-xs text-ink-2">
            <li>
              {card.name} · {card.number} · {card.setName}
            </li>
            <li>
              {result.grader} {tierLabel(result.tier)} · {result.verdict} · P(10) {pct(result.distribution[10] ?? 0)} · {usd(result.expectedProfitUsd, { sign: true })}
            </li>
            <li>a timestamp and a public receipt number</li>
          </ul>
          <p className="mt-2 text-sm font-semibold text-ink">Never your photo, never your name or email. It can&apos;t be edited after.</p>
          <label className="mt-3 flex min-h-11 items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--ink)]" checked={intends} onChange={(e) => setIntends(e.target.checked)} />
            <span>I plan to submit this card, and I&apos;ll report the grade when it comes back.</span>
          </label>
          <div className="mt-3 flex gap-2">
            <Btn variant="primary" onClick={log} loading={logState === "sending"}>
              Publish prediction
            </Btn>
            <Btn variant="ghost" onClick={() => setLogOpen(false)}>
              Cancel
            </Btn>
          </div>
          {logState === "error" ? (
            <p className="mt-2 text-sm text-bad" role="alert">
              {logErr}
            </p>
          ) : null}
        </Panel>
      ) : null}
      {logged ? (
        <p className="rounded-xl border border-line bg-card p-3 font-mono text-sm" role="status">
          Logged as{" "}
          <Link href={`/receipts/${encodeURIComponent(logged.id)}`} className="font-bold underline underline-offset-4">
            {logged.id}
          </Link>
          . {intends ? "Come back and report the grade from that page." : ""}
        </p>
      ) : null}
    </div>
  );
}
