import type { ReactNode } from "react";
import { Badge, EstimateBadge } from "@/components/ui/Badge";
import { Money, formatPct } from "@/components/ui/Money";
import { ProbabilityBar } from "@/components/ui/ProbabilityBar";
import { cn } from "@/components/ui/cn";
import { VerdictStamp } from "./VerdictStamp";
import { EXAMPLE as E } from "./exampleData";

function Line({ label, children, strong, note }: { label: ReactNode; children: ReactNode; strong?: boolean; note?: ReactNode }) {
  return (
    <div className={cn("flex items-baseline gap-2 text-sm", strong ? "font-semibold text-ink" : "text-ink-2")}>
      <span className="min-w-0">
        {label}
        {note && <span className="ml-1 inline-block text-xs text-ink-3">{note}</span>}
      </span>
      <span className="leader" aria-hidden="true" />
      <span className="shrink-0">{children}</span>
    </div>
  );
}

/**
 * Receipt-style verdict for the static EXAMPLE card. Clearly labelled example.
 * Mirrors the layout the real verdict screen uses, so the landing page sells the actual product.
 */
export function ExampleVerdictCard({ className }: { className?: string }) {
  return (
    <article
      aria-label="Example verdict receipt"
      className={cn("receipt-edge rise-in relative rounded-t-card border-x border-t border-line bg-receipt p-5 shadow-lift sm:p-6", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-ink-3">Verdict receipt</p>
          <h3 className="mt-1 truncate font-display text-2xl font-bold uppercase leading-tight text-ink">{E.cardName}</h3>
          <p className="font-mono text-xs text-ink-3">{E.setLine} · {E.grader} · raw NM</p>
        </div>
        <Badge tone="borderline" className="shrink-0">Example</Badge>
      </div>

      <div className="my-4 border-t border-dashed border-line-strong" />

      <ProbabilityBar
        distribution={E.distribution}
        grader={E.grader}
        breakEvenGrade={E.breakEvenGrade}
        caption="Estimated grade odds"
      />

      <div className="my-4 border-t border-dashed border-line-strong" />

      <div className="flex flex-col gap-1.5 font-mono">
        <Line label="Expected graded" note={<EstimateBadge className="align-middle" />}>
          <Money amount={E.expectedGraded} />
        </Line>
        <Line label={`Selling fees (${Math.round(E.sellingFeeRate * 100)}%)`}>
          <Money amount={-E.sellingFeesGraded} />
        </Line>
        <Line label="Grading fee">
          <Money amount={-E.gradingFee} />
        </Line>
        <Line label="Ship + insure, both ways">
          <Money amount={-E.shipping} />
        </Line>
        <Line label="Net if you grade" strong>
          <Money amount={E.netIfGraded} />
        </Line>
        <Line label="Less: net if you sell raw">
          <Money amount={-E.netRaw} />
        </Line>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t-2 border-ink pt-4">
        <VerdictStamp verdict="SLEEVE" size="sm" animate delayMs={700} rotate={-7} />
        <div className="ml-auto text-right">
          <span className="block font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink">Grading vs. raw</span>
          <Money amount={E.expectedGain} signed className="text-3xl font-semibold" />
          <p className="mt-1 font-mono text-xs text-ink-3">
            P(lose money) {formatPct(E.probabilityOfLoss)} · only a {E.grader} 10 wins
          </p>
        </div>
      </div>
    </article>
  );
}
