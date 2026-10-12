import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "ink" | "sleeve" | "slab" | "borderline" | "good" | "bad" | "estimate";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  icon?: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-paper-2 text-ink-2 ring-line",
  ink: "bg-ink text-on-ink ring-ink",
  sleeve: "bg-sleeve-soft text-sleeve-ink ring-sleeve/35",
  slab: "bg-slab-soft text-slab-ink ring-slab/50",
  borderline: "bg-borderline-soft text-borderline-ink ring-borderline/40",
  good: "bg-good/10 text-good ring-good/30",
  bad: "bg-bad/10 text-bad ring-bad/30",
  // Dashed outline: this number is a model output, not market data.
  estimate: "bg-transparent text-ink-2 ring-0 outline-1 outline-dashed outline-ink-3 -outline-offset-1",
};

/** Pill label. Use tone="estimate" (or <EstimateBadge />) next to every modelled number. */
export function Badge({ tone = "neutral", size = "sm", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-mono font-semibold uppercase ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[0.66rem] tracking-[0.08em]" : "px-2.5 py-1 text-xs tracking-[0.08em]",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

/** The honesty label. Required beside graded-price guesses and gem-rate priors. */
export function EstimateBadge({ className, label = "estimate" }: { className?: string; label?: string }) {
  return (
    <Badge tone="estimate" className={className} title="Modelled number, not a market sale">
      {label}
    </Badge>
  );
}
