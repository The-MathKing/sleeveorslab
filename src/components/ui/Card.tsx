import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "raised" | "flat" | "receipt" | "sleeve" | "slab" | "borderline";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  /** Element to render. Use "section"/"article" when the card is a landmark of content. */
  as?: "div" | "section" | "article" | "aside" | "li";
  padding?: "none" | "sm" | "md" | "lg";
}

const variants: Record<CardVariant, string> = {
  default: "bg-card border border-line shadow-card",
  raised: "bg-card border border-line shadow-lift",
  flat: "bg-paper-2 border border-line",
  // Receipt paper: warm white, monospace-friendly, torn bottom edge.
  receipt: "receipt-edge bg-receipt border-x border-t border-line shadow-card rounded-b-none",
  // Penny sleeve: cool tint with plastic sheen.
  sleeve: "sleeve-sheen bg-sleeve-soft border border-sleeve/35 text-ink",
  // Slab: gold frame, like the case around a graded card.
  slab: "bg-card border-[3px] border-slab shadow-card",
  borderline: "bg-borderline-soft border border-borderline/40",
};

const paddings = { none: "", sm: "p-3", md: "p-4 sm:p-5", lg: "p-5 sm:p-7" } as const;

/** Surface for grouped content. `Panel` is an alias. */
export function Card({ variant = "default", as = "div", padding = "md", className, ...rest }: CardProps) {
  const Tag = as;
  return <Tag className={cn("rounded-card", variants[variant], paddings[padding], className)} {...rest} />;
}

export const Panel = Card;

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex flex-col gap-1", className)} {...rest} />;
}

export function CardTitle({
  className,
  as: Tag = "h3",
  ...rest
}: HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Tag
      className={cn("font-display text-xl font-bold uppercase leading-tight tracking-wide text-ink", className)}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink-2", className)} {...rest} />;
}

/** Small uppercase monospace label, like the header of a slab label. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-3", className)}>
      {children}
    </p>
  );
}
