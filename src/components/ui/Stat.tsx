import type { ReactNode } from "react";
import { cn } from "./cn";
import { EstimateBadge } from "./Badge";

export type StatTone = "ink" | "good" | "bad" | "sleeve" | "slab" | "borderline" | "muted";

export interface StatProps {
  label: ReactNode;
  /** Usually a <Money/> or a formatted string. Rendered huge, in monospace. */
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  size?: "sm" | "md" | "lg" | "xl";
  /** Adds the dashed "estimate" badge after the label. */
  estimate?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

const tones: Record<StatTone, string> = {
  ink: "text-ink",
  good: "text-good",
  bad: "text-bad",
  sleeve: "text-sleeve-ink",
  slab: "text-slab-deep",
  borderline: "text-borderline",
  muted: "text-ink-2",
};

const sizes = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-[2.6rem]",
  xl: "text-[clamp(2.75rem,11vw,4.5rem)]",
} as const;

/** Big monospace number + small label. Use for $ amounts, probabilities, counts. */
export function Stat({ label, value, hint, tone = "ink", size = "md", estimate, align = "left", className }: StatProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</span>
        {estimate && <EstimateBadge />}
      </div>
      <div className={cn("font-mono font-semibold leading-none tracking-tight tabular-nums", sizes[size], tones[tone])}>
        {value}
      </div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}
