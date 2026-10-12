// Receipt-styled prediction entry. Server-safe (no hooks), used by /receipts and /receipts/[id].
import clsx from "clsx";
import type { Grade, Prediction } from "@/lib/types";
import { pct, stamp, usd } from "./format";
import { VerdictBadge } from "./VerdictBadge";

export function mostLikelyGrade(p: Prediction): Grade {
  const grades: Grade[] = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  return grades.reduce((a, b) => ((p.distribution[b] ?? 0) > (p.distribution[a] ?? 0) ? b : a), 10 as Grade);
}

export function receiptStats(list: Prediction[]) {
  const resolved = list.filter((p) => p.outcome);
  const hits = resolved.filter((p) => p.outcome!.grade === mostLikelyGrade(p)).length;
  const brier = resolved.length
    ? resolved.reduce((s, p) => {
        const p10 = p.distribution[10] ?? 0;
        const y = p.outcome!.grade === 10 ? 1 : 0;
        return s + (p10 - y) ** 2;
      }, 0) / resolved.length
    : undefined;
  return { logged: list.length, resolved: resolved.length, hitRate: resolved.length ? hits / resolved.length : undefined, brier };
}

export function Zigzag({ flip }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className={clsx("h-2 w-full", flip && "rotate-180")}
      style={{
        background:
          "linear-gradient(-45deg, var(--card) 4px, transparent 0) 0 0 / 10px 10px repeat-x, linear-gradient(45deg, var(--card) 4px, transparent 0) 0 0 / 10px 10px repeat-x",
      }}
    />
  );
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-3", strong && "font-bold")}>
      <span className="text-ink-2">{k}</span>
      <span className="text-right tabular-nums">{v}</span>
    </div>
  );
}

export function ReceiptCard({ p, full = false }: { p: Prediction; full?: boolean }) {
  const p10 = p.distribution[10] ?? 0;
  const ml = mostLikelyGrade(p);
  const hit = p.outcome ? p.outcome.grade === ml : undefined;
  return (
    <div className="drop-shadow-sm">
      <Zigzag flip />
      <div className="bg-card px-4 py-3 font-mono text-[13px] leading-relaxed text-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold tracking-wider">{p.id}</p>
            <p className="text-[11px] text-ink-3">{stamp(p.createdAt)}</p>
          </div>
          <VerdictBadge verdict={p.verdict} size={full ? "md" : "sm"} />
        </div>
        <div className="my-2 border-t border-dashed border-line" />
        <p className="font-semibold">{p.card.name}</p>
        <p className="text-[11px] text-ink-3">
          {p.card.number} · {p.card.setName}
        </p>
        <div className="my-2 border-t border-dashed border-line" />
        <Row k="Grader" v={`${p.grader} · ${p.tierId}`} />
        <Row k="P(10)" v={pct(p10, 1)} />
        <Row k="Most likely" v={`${p.grader} ${ml}`} />
        <Row k="E[profit]" v={usd(p.expectedProfitUsd, { sign: true })} />
        {full ? (
          <>
            <div className="my-2 border-t border-dashed border-line" />
            <p className="mb-1 text-[11px] uppercase tracking-widest text-ink-3">Distribution</p>
            {([10, 9, 8, 7, 6] as Grade[]).map((g) => (
              <Row key={g} k={`${p.grader} ${g}`} v={`${pct(p.distribution[g] ?? 0, 1).padStart(6, " ")}`} />
            ))}
            <Row
              k="≤ 5"
              v={pct(
                ([5, 4, 3, 2, 1] as Grade[]).reduce((s, g) => s + (p.distribution[g] ?? 0), 0),
                1,
              )}
            />
            <Row k="Plans to submit" v={p.intendsToSubmit ? "yes" : "no"} />
          </>
        ) : null}
        <div className="my-2 border-t border-dashed border-line" />
        {p.outcome ? (
          <>
            <Row strong k="Graded" v={`${p.grader} ${p.outcome.grade}`} />
            <Row k="Result" v={<span className={hit ? "text-good" : "text-bad"}>{hit ? "HIT (most-likely grade)" : "MISS"}</span>} />
            {full && p.outcome.certNumber ? <Row k="Cert #" v={p.outcome.certNumber} /> : null}
            {full ? <Row k="Reported" v={stamp(p.outcome.reportedAt)} /> : null}
          </>
        ) : (
          <Row strong k="Outcome" v={<span className="text-ink-3">PENDING</span>} />
        )}
        {full ? <p className="mt-3 text-center text-[11px] tracking-widest text-ink-3">*** SLEEVEORSLAB.COM ***</p> : null}
      </div>
      <Zigzag />
    </div>
  );
}
