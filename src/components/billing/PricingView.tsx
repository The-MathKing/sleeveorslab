"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { Prose } from "@/components/brand/Prose";
import { WaitlistForm } from "@/components/brand/WaitlistForm";
import { featuredPlan, orderedPaidPlans, PLANS, type Plan } from "@/lib/billing/plans";
import { BuyButton, ManageSubscriptionButton } from "./BuyButton";
import { useBillingConfig, usePricingVariant } from "./client";
import { useEntitlement } from "./useEntitlement";

export const PRICE_NOTE = "Prices in USD. Cancel any time in two clicks.";

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** The /pricing body: plans from plans.ts, buy buttons when payments are on, waitlist when off. */
export function PricingView() {
  const config = useBillingConfig();
  const enabled = !!config?.enabled;
  const variant = usePricingVariant(config?.splitTest);
  const ent = useEntitlement();
  const featured = featuredPlan(variant);
  const plans: Plan[] = [PLANS.free, ...orderedPaidPlans(variant)];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isFeatured = p.id === featured;
          const owned = (p.id === "pro-monthly" && ent.isPro) || (p.id === "pack-100" && ent.credits > 0);
          const status =
            p.id === "free" ? null : owned ? (p.id === "pro-monthly" ? "Your plan" : `${ent.credits} left`) : enabled ? null : config ? "Coming soon" : null;
          return (
            <Card
              key={p.id}
              as="section"
              variant={isFeatured ? "slab" : "default"}
              padding="lg"
              aria-labelledby={`plan-${p.id}`}
              className={cn("flex flex-col", isFeatured && "md:-translate-y-2")}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id={`plan-${p.id}`} className="font-display text-2xl font-bold uppercase text-ink">
                  {p.name}
                </h2>
                {status && <Badge tone={isFeatured || owned ? "slab" : "neutral"}>{status}</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-2">{p.blurb}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-mono text-4xl font-semibold text-ink">{p.price}</span>
                <span className="font-mono text-sm text-ink-3">{p.per}</span>
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-ink-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {p.id === "free" ? (
                  <Button href="/scan" fullWidth>
                    Check a card
                  </Button>
                ) : !config ? (
                  <div className="h-11 animate-pulse rounded-[10px] bg-paper-2" aria-hidden="true" />
                ) : p.id === "pro-monthly" && ent.isPro ? (
                  <ManageSubscriptionButton fullWidth />
                ) : enabled ? (
                  <BuyButton
                    plan={p.id}
                    variant={variant}
                    buttonVariant={isFeatured ? "slab" : "outline"}
                    label={p.id === "pro-monthly" ? `Get Pro, ${p.price}/mo` : owned ? `Add 100 more, ${p.price}` : `Buy 100 scans, ${p.price}`}
                  />
                ) : (
                  <Button href="#waitlist" variant={isFeatured ? "slab" : "outline"} fullWidth>
                    Join the waitlist
                  </Button>
                )}
              </div>
              {p.id === "pro-monthly" && ent.isPro && (ent.renewsAt || ent.endsAt) && (
                <p className="mt-2 text-center font-mono text-xs text-ink-3">
                  {ent.endsAt ? `Ends ${shortDate(ent.endsAt)}` : `Renews ${shortDate(ent.renewsAt)}`}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-mono text-xs text-ink-3">{PRICE_NOTE}</p>
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          {ent.hasToken ? (
            <ManageSubscriptionButton variant="ghost" size="sm" label="Manage subscription" />
          ) : (
            <Link href="/pricing/restore" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Manage subscription
            </Link>
          )}
          <Link href="/pricing/restore" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Restore purchase
          </Link>
        </p>
      </div>

      <Card variant="flat" padding="lg" className="mt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase text-ink">Shop plan</h2>
            <p className="text-sm text-ink-2">
              For card shops sorting buylist and trade-ins at the counter. Multiple devices, shop-level presets. Later this year.
            </p>
          </div>
          <Badge>Later</Badge>
        </div>
      </Card>

      {config && !enabled && (
        <section id="waitlist" aria-labelledby="wl" className="mt-16 scroll-mt-24">
          <Card padding="lg" className="mx-auto max-w-xl">
            <h2 id="wl" className="font-display text-3xl font-bold uppercase text-ink">
              Get Pro first
            </h2>
            <p className="mb-5 mt-1 text-sm text-ink-2">One email when it opens. Nothing else.</p>
            <WaitlistForm source="pricing" />
          </Card>
        </section>
      )}

      <div className="mt-16">
        <Prose>
          <h2>The fine print, plainly</h2>
          <ul>
            {enabled ? (
              <li>
                Prices are in USD. The price on the button is the price you pay; we don&apos;t add fees at checkout. Payment is
                handled by Stripe, so your card number never touches our servers.
              </li>
            ) : (
              <li>Prices are in USD and may change before launch. Nothing is billed today; payments aren&apos;t switched on yet.</li>
            )}
            <li>
              Pro renews monthly until you cancel. Cancel any time from &ldquo;Manage subscription&rdquo; (Stripe&apos;s billing
              portal): two clicks, no email, no exit survey. You keep Pro until the end of the month you paid for.
            </li>
            <li>The scan pack is a one-time payment. Its 100 credits never expire and nothing renews.</li>
            <li>A &ldquo;verdict&rdquo; is one card run through the full fee-and-odds math. Centering checks and lookups don&apos;t count.</li>
            <li>
              There are no accounts. Your purchase is remembered in this browser. On a new phone or browser, use
              &ldquo;Restore purchase&rdquo; with the email you paid with.
            </li>
            <li>Paid plans won&apos;t change the math. Free and Pro users get the same honest answer; Pro just gets more of them.</li>
          </ul>
        </Prose>
      </div>
    </>
  );
}
