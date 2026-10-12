"use client";

import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { WaitlistForm } from "@/components/brand/WaitlistForm";
import { featuredPlan, FREE_VERDICTS_PER_DAY, orderedPaidPlans } from "@/lib/billing/plans";
import { BuyButton } from "./BuyButton";
import { useBillingConfig, usePricingVariant } from "./client";
import { PRICE_NOTE } from "./PricingView";
import { useEntitlement } from "./useEntitlement";

export interface UpgradePanelProps {
  /** Where this panel is shown, e.g. "soft-limit" or "binder". Passed to the waitlist form. */
  source?: string;
  /** Verdicts used today, for the copy. */
  count?: number;
  /** What ran out, for the copy: "verdicts" (single scan) or "binder" (batch triage). */
  context?: "verdicts" | "binder";
  /** While payments are off, render nothing instead of the waitlist (e.g. they already joined). */
  hideWaitlist?: boolean;
  className?: string;
}

/**
 * The upgrade CTA that replaces "Pro is coming — join the waitlist".
 * Payments on: the two paid plans with buy buttons (ordered by the pricing test).
 * Payments off: the same waitlist message as before. Renders nothing for Pro users.
 */
export function UpgradePanel({ source = "soft-limit", count, context = "verdicts", hideWaitlist = false, className }: UpgradePanelProps) {
  const config = useBillingConfig();
  const variant = usePricingVariant(config?.splitTest);
  const ent = useEntitlement();

  if (!config || ent.loading || ent.isPro) return null;

  const used =
    context === "binder"
      ? "Binder triage runs a full verdict on every card."
      : count && count > FREE_VERDICTS_PER_DAY
        ? `That's ${count} verdicts today. Free covers ${FREE_VERDICTS_PER_DAY} a day.`
        : `Free covers ${FREE_VERDICTS_PER_DAY} verdicts a day.`;

  if (!config.enabled) {
    if (hideWaitlist) return null;
    return (
      <Card variant="slab" padding="lg" className={className}>
        <h3 className="font-display text-2xl font-bold uppercase leading-tight text-ink">Pro is coming — join the waitlist</h3>
        <p className="mb-4 mt-1 text-sm text-ink-2">
          {used} Keep going for now, it&apos;s on us. Pro adds unlimited scans, binder triage, and price alerts.
        </p>
        <WaitlistForm source={source} />
      </Card>
    );
  }

  const featured = featuredPlan(variant);
  return (
    <Card variant="slab" padding="lg" className={className}>
      <Eyebrow>Free limit reached</Eyebrow>
      <h3 className="mt-1 font-display text-2xl font-bold uppercase leading-tight text-ink">Keep checking cards</h3>
      <p className="mt-1 text-sm text-ink-2">
        {used} Same math either way; paying just gets you more of it.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {orderedPaidPlans(variant).map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex flex-col rounded-[10px] border p-3",
              p.id === featured ? "border-slab bg-slab-soft/40" : "border-line bg-card",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-bold uppercase text-ink">{p.name}</span>
              <span className="font-mono text-sm text-ink">
                <span className="font-semibold">{p.price}</span> <span className="text-ink-3">{p.per}</span>
              </span>
            </div>
            <p className="mb-3 mt-0.5 flex-1 text-xs text-ink-2">
              {p.id === "pro-monthly" ? "Unlimited verdicts and binder triage. Cancel any time." : "100 scans, never expire. Pay once."}
            </p>
            <BuyButton
              plan={p.id}
              variant={variant}
              size="sm"
              buttonVariant={p.id === featured ? "slab" : "outline"}
              label={p.id === "pro-monthly" ? "Get Pro" : ent.credits > 0 ? "Add 100 scans" : "Buy 100 scans"}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-ink-3">
        <span>{PRICE_NOTE}</span>
        <Link href="/pricing/restore" className="font-sans font-semibold text-ink underline decoration-line-strong underline-offset-4">
          Already paid? Restore purchase
        </Link>
      </p>
    </Card>
  );
}
