"use client";
// Local UI primitives for the app flows. Styled with brand tokens only.
// SWAP POINT: the lead can replace these with @/components/ui equivalents
// (Button, Card, Badge, Input, Money, ProbabilityBar, Tabs) without touching screens.
import clsx from "clsx";
import { LoaderCircle, AlertTriangle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { usd } from "./format";

type BtnVariant = "primary" | "secondary" | "ghost" | "slab" | "danger";

export function Btn({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        size === "sm" && "min-h-9 px-3 text-sm",
        size === "md" && "min-h-11 px-4 text-[15px]",
        size === "lg" && "min-h-13 px-5 text-base",
        variant === "primary" && "bg-ink text-paper hover:opacity-90",
        variant === "secondary" && "bg-card text-ink border border-line hover:bg-paper-2",
        variant === "ghost" && "text-ink-2 hover:bg-paper-2",
        variant === "slab" && "bg-slab text-ink hover:opacity-90",
        variant === "danger" && "bg-card text-bad border border-line hover:bg-paper-2",
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Panel({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={clsx("rounded-[var(--radius)] border border-line bg-card", className)}>{children}</As>;
}

export function Money({ value, sign, className }: { value: number | undefined; sign?: boolean; className?: string }) {
  const tone = sign && value !== undefined ? (value > 0 ? "text-good" : value < 0 ? "text-bad" : "") : "";
  return <span className={clsx("font-mono tabular-nums", tone, className)}>{usd(value, { sign })}</span>;
}

export function EstimateTag({ className, label = "estimate" }: { className?: string; label?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border border-borderline/40 bg-borderline-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-paper-2", className)} aria-hidden />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label ?? "Loading…"}
    </span>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-bad/30 bg-card p-3 text-sm text-ink">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
      <div className="flex-1">{children}</div>
      {onRetry ? (
        <Btn size="sm" onClick={onRetry}>
          Retry
        </Btn>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-line bg-card px-6 py-10 text-center">
      {icon ? <div className="text-ink-3">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-ink-2">{body}</p> : null}
      {action}
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
      {children}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={clsx(
        "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-base text-ink placeholder:text-ink-3",
        "focus:outline-2 focus:outline-offset-0 focus:outline-ink",
        className,
      )}
    />
  );
}

/** USD input that tolerates blanks (undefined = "use market data"). */
export function UsdInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-ink-3">$</span>
      <TextInput
        id={id}
        inputMode="decimal"
        className="pl-7 font-mono"
        placeholder={placeholder}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.]/g, "");
          if (t === "") return onChange(undefined);
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

export function Bar({ value, tone = "ink", label }: { value: number; tone?: "ink" | "slab" | "sleeve" | "borderline" | "bad"; label?: string }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(w)} aria-label={label}>
      <div
        className={clsx(
          "h-full rounded-full transition-[width] duration-300",
          tone === "ink" && "bg-ink",
          tone === "slab" && "bg-slab",
          tone === "sleeve" && "bg-sleeve",
          tone === "borderline" && "bg-borderline",
          tone === "bad" && "bg-bad",
        )}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-paper-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-9 rounded-lg px-3 text-sm font-semibold transition",
            o.value === value ? "bg-card text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <header className="mb-5">
      {kicker ? <p className="font-mono text-xs uppercase tracking-widest text-ink-3">{kicker}</p> : null}
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {children ? <div className="mt-2 text-[15px] text-ink-2">{children}</div> : null}
    </header>
  );
}

/** Card thumbnail hot-linked from the provider (never re-hosted). */
export function CardThumb({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  if (!src) return <div className={clsx("aspect-[63/88] rounded-md bg-paper-2", className)} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={clsx("aspect-[63/88] rounded-md bg-paper-2 object-cover", className)} />
  );
}
