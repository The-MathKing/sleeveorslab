import type { CSSProperties } from "react";
import type { Grade, GradeDistribution, GraderId } from "@/lib/types";
import { cn } from "./cn";
import { formatPct } from "./Money";

export interface ProbabilityBarProps {
  distribution: GradeDistribution;
  /** Shown in labels, e.g. "PSA 10". Omit for bare grade numbers. */
  grader?: GraderId;
  /** "stacked" = one horizontal bar; "columns" = mini bar chart. Default "columns". */
  variant?: "stacked" | "columns";
  /** Lowest grade shown on its own; everything below folds into "≤ n-1". Default 6. */
  minGrade?: Grade;
  /** Grades at or above this break even. Draws a divider and tints the profitable side. */
  breakEvenGrade?: Grade;
  /** Accessible caption, also shown visually unless hideCaption. */
  caption?: string;
  hideCaption?: boolean;
  /** Animate bars growing on mount (reduced-motion safe). */
  animate?: boolean;
  className?: string;
}

type Bucket = { key: string; label: string; short: string; p: number; grade: number; color: string };

/** Fixed grade palette: gold for 10, pale gold 9, sleeve blues for 8/7, grays below. */
function colorFor(grade: number): string {
  if (grade >= 10) return "var(--slab)";
  if (grade === 9) return "color-mix(in oklab, var(--slab) 50%, var(--card))";
  if (grade === 8) return "var(--sleeve)";
  if (grade === 7) return "color-mix(in oklab, var(--sleeve) 50%, var(--card))";
  if (grade === 6) return "var(--ink-3)";
  return "var(--line-strong)";
}

export function bucketize(distribution: GradeDistribution, minGrade: number = 6, grader?: GraderId): Bucket[] {
  const prefix = grader ? `${grader} ` : "";
  let low = 0;
  const out: Bucket[] = [];
  for (let g = 1; g < minGrade; g++) low += distribution[g as Grade] ?? 0;
  if (minGrade > 1) {
    out.push({
      key: "low",
      label: `${prefix}${minGrade - 1} or lower`,
      short: `≤${minGrade - 1}`,
      p: low,
      grade: minGrade - 1,
      color: colorFor(minGrade - 1),
    });
  }
  for (let g = minGrade; g <= 10; g++) {
    out.push({
      key: String(g),
      label: `${prefix}${g}`,
      short: String(g),
      p: distribution[g as Grade] ?? 0,
      grade: g,
      color: colorFor(g),
    });
  }
  return out;
}

/**
 * Grade-probability chart, P(grade) for 6..10 with the tail folded into "≤5".
 * Includes a visually hidden table so screen readers get every number.
 */
export function ProbabilityBar({
  distribution,
  grader,
  variant = "columns",
  minGrade = 6,
  breakEvenGrade,
  caption,
  hideCaption,
  animate = true,
  className,
}: ProbabilityBarProps) {
  const buckets = bucketize(distribution, minGrade, grader);
  const total = buckets.reduce((s, b) => s + b.p, 0) || 1;
  const max = Math.max(...buckets.map((b) => b.p), 0.0001);
  const cap = caption ?? `Estimated ${grader ? `${grader} ` : ""}grade probabilities`;

  return (
    <figure className={cn("m-0 w-full min-w-0", className)}>
      {!hideCaption && (
        <figcaption className="mb-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {cap}
        </figcaption>
      )}

      {variant === "stacked" ? (
        <div aria-hidden="true">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-paper-2 ring-1 ring-inset ring-line">
            {buckets.map((b, i) =>
              b.p > 0 ? (
                <div
                  key={b.key}
                  className={cn("h-full", animate && "bar-grow", i > 0 && "border-l-2 border-card")}
                  style={{ width: `${(b.p / total) * 100}%`, background: b.color, "--bar-delay": `${i * 60}ms` } as CSSProperties}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {buckets.map((b) => (
              <li key={b.key} className="flex items-center gap-1.5 text-xs text-ink-2">
                <span className="size-2.5 rounded-sm ring-1 ring-inset ring-black/10" style={{ background: b.color }} />
                <span className="font-mono">
                  {b.short} <span className="font-semibold text-ink">{formatPct(b.p)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div aria-hidden="true" className="relative">
          <div className="grid h-28 grid-flow-col items-end gap-1.5 sm:gap-2" style={{ gridAutoColumns: "minmax(0,1fr)" }}>
            {buckets.map((b, i) => {
              const profitable = breakEvenGrade !== undefined && b.key !== "low" && b.grade >= breakEvenGrade;
              const isDivider = breakEvenGrade !== undefined && b.grade === breakEvenGrade && b.key !== "low";
              return (
                <div key={b.key} className="relative flex h-full min-w-0 flex-col items-center justify-end">
                  {isDivider && (
                    <span className="absolute -left-[4px] top-0 bottom-0 border-l-[1.5px] border-dashed border-good sm:-left-[5px]" />
                  )}
                  <span className={cn("mb-1 font-mono text-[0.68rem] font-semibold tabular-nums sm:text-xs", b.p >= max ? "text-ink" : "text-ink-2")}>
                    {formatPct(b.p)}
                  </span>
                  <div
                    className={cn("w-full rounded-t-[5px]", animate && "bar-grow-y", profitable && "ring-2 ring-inset ring-good/60")}
                    style={{
                      height: `${Math.max((b.p / max) * 78, b.p > 0 ? 3 : 1)}%`,
                      background: b.p > 0 ? b.color : "var(--line)",
                      "--bar-delay": `${i * 70}ms`,
                    } as CSSProperties}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 grid grid-flow-col gap-1.5 border-t border-line pt-1.5 sm:gap-2" style={{ gridAutoColumns: "minmax(0,1fr)" }}>
            {buckets.map((b) => (
              <span key={b.key} className="text-center font-mono text-[0.7rem] font-semibold text-ink-3">
                {b.short}
              </span>
            ))}
          </div>
          {breakEvenGrade !== undefined && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
              <span className="inline-block h-3 border-l-[1.5px] border-dashed border-good" />
              Grades right of the line beat selling raw (break-even: {grader ? `${grader} ` : ""}
              {breakEvenGrade}).
            </p>
          )}
        </div>
      )}

      <table className="sr-only">
        <caption>{cap}</caption>
        <thead>
          <tr>
            <th scope="col">Grade</th>
            <th scope="col">Probability</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{formatPct(b.p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Simple single-value meter (0..1), e.g. "probability of loss". */
export function ProgressBar({
  value,
  label,
  tone = "ink",
  showValue = true,
  className,
}: {
  value: number;
  label: string;
  tone?: "ink" | "good" | "bad" | "sleeve" | "slab" | "borderline";
  showValue?: boolean;
  className?: string;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const fill = {
    ink: "bg-ink",
    good: "bg-good",
    bad: "bg-bad",
    sleeve: "bg-sleeve",
    slab: "bg-slab",
    borderline: "bg-borderline",
  }[tone];
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-2">{label}</span>
        {showValue && <span className="font-mono font-semibold text-ink">{formatPct(v)}</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        className="h-2 w-full overflow-hidden rounded-full bg-paper-2 ring-1 ring-inset ring-line"
      >
        <div className={cn("bar-grow h-full rounded-full", fill)} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}
