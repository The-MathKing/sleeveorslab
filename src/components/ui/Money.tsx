import { cn } from "./cn";

export interface FormatUsdOptions {
  /** Prefix positive numbers with "+". Negative numbers always get a true minus sign (−). */
  signed?: boolean;
  /** Show cents. Default: true under $1,000, false at or above. */
  cents?: boolean;
  /** Compact notation: $1.2k. */
  compact?: boolean;
}

const MINUS = "−";

/** Format USD the house way: "$1,240", "−$38.20", "+$12.00". Monospace-friendly. */
export function formatUsd(amount: number, opts: FormatUsdOptions = {}): string {
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  const cents = opts.cents ?? abs < 1000;
  const body = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact ? 0 : cents ? 2 : 0,
    maximumFractionDigits: opts.compact ? 1 : cents ? 2 : 0,
  }).format(abs);
  const isZero = body.replace(/[^1-9]/g, "") === "";
  if (amount < 0 && !isZero) return `${MINUS}${body}`;
  if (opts.signed && amount > 0 && !isZero) return `+${body}`;
  return body;
}

export interface MoneyProps extends FormatUsdOptions {
  amount: number;
  /**
   * Color by sign: positive = good (green), negative = bad (red), zero = ink.
   * Defaults to true when `signed` is set.
   */
  colorize?: boolean;
  /** Small "≈" prefix for modelled numbers. Pair with an EstimateBadge nearby. */
  approximate?: boolean;
  className?: string;
}

/** A dollar amount in monospace with optional sign + color. Renders a <data> element with the raw value. */
export function Money({ amount, signed, cents, compact, colorize, approximate, className }: MoneyProps) {
  const color = colorize ?? signed ?? false;
  const tone = !color || !Number.isFinite(amount) || Math.abs(amount) < 0.005 ? "" : amount > 0 ? "text-good" : "text-bad";
  return (
    <data value={Number.isFinite(amount) ? amount.toFixed(2) : ""} className={cn("font-mono tabular-nums", tone, className)}>
      {approximate && <span aria-label="approximately">≈</span>}
      {formatUsd(amount, { signed, cents, compact })}
    </data>
  );
}

/** "37%" / "<1%" / ">99%". */
export function formatPct(p: number, digits = 0): string {
  if (!Number.isFinite(p)) return "—";
  const v = p * 100;
  if (v > 0 && v < 1) return "<1%";
  if (v < 100 && v > 99) return ">99%";
  return `${v.toFixed(digits)}%`;
}
