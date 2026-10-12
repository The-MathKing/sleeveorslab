// Compact verdict chip for tables and lists. The hero verdict uses the brand VerdictStamp.
import clsx from "clsx";
import type { Verdict } from "@/lib/types";

const COPY: Record<Verdict, { word: string; sub: string }> = {
  SLAB: { word: "SLAB", sub: "grade it" },
  SLEEVE: { word: "SLEEVE", sub: "keep it raw" },
  BORDERLINE: { word: "BORDERLINE", sub: "coin flip" },
};

export function verdictTone(v: Verdict) {
  return v === "SLAB"
    ? "bg-slab-soft text-slab-ink border-slab/50"
    : v === "BORDERLINE"
      ? "bg-borderline-soft text-ink border-borderline/50"
      : "bg-sleeve-soft text-sleeve-ink border-sleeve/50";
}

export function VerdictBadge({ verdict, size = "md", className }: { verdict: Verdict; size?: "sm" | "md" | "lg"; className?: string }) {
  const c = COPY[verdict];
  return (
    <span
      className={clsx(
        "inline-flex flex-col items-center justify-center border-2 font-mono font-bold uppercase leading-none",
        verdictTone(verdict),
        size === "sm" && "rounded-md px-2 py-1 text-[11px] tracking-wider",
        size === "md" && "rounded-lg px-3 py-1.5 text-sm tracking-widest",
        size === "lg" && "-rotate-2 rounded-2xl border-[3px] px-6 py-4 text-4xl tracking-[0.15em] sm:text-5xl",
        className,
      )}
      aria-label={`Verdict: ${c.word} (${c.sub})`}
    >
      <span>{c.word}</span>
      {size === "lg" ? <span className="mt-2 text-xs font-semibold tracking-[0.3em] opacity-70">{c.sub}</span> : null}
    </span>
  );
}
