import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { PageShell, Prose } from "@/components/brand/Prose";
import { WaitlistForm } from "@/components/brand/WaitlistForm";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free: card lookup, centering, and 3 verdicts a day. Pro and scan packs are coming soon.",
  alternates: { canonical: "/pricing" },
};

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    per: "forever",
    blurb: "For the card you pulled last night.",
    features: ["Card lookup + raw prices", "Centering check, unlimited", "3 full verdicts a day", "Log verdicts to Receipts", "On-device collection"],
    cta: { label: "Check a card", href: "/scan" },
    status: null as string | null,
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$6.99",
    per: "/ month",
    blurb: "For people who submit more than they'd like to admit.",
    features: ["Unlimited verdicts", "Binder Audit for whole submissions", "Compare tiers across PSA and CGC", "Custom fee, shipping and sell-fee presets", "CSV export"],
    cta: null,
    status: "Coming soon",
    featured: true,
  },
  {
    id: "pack",
    name: "Scan pack",
    price: "$19",
    per: "100 verdicts",
    blurb: "For one big submission, no subscription.",
    features: ["100 full verdicts, no expiry", "Everything in Free", "Binder Audit included"],
    cta: null,
    status: "Coming soon",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <PageShell
      eyebrow="Pricing"
      title="Cheaper than one bad submission."
      lede="One avoided grading fee pays for most of a year of Pro. The free tier covers most collectors, and that's on purpose."
      wide
    >
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card
            key={p.id}
            as="section"
            variant={p.featured ? "slab" : "default"}
            padding="lg"
            aria-labelledby={`plan-${p.id}`}
            className={cn("flex flex-col", p.featured && "md:-translate-y-2")}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id={`plan-${p.id}`} className="font-display text-2xl font-bold uppercase text-ink">
                {p.name}
              </h2>
              {p.status && <Badge tone={p.featured ? "slab" : "neutral"}>{p.status}</Badge>}
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
              {p.cta ? (
                <Button href={p.cta.href} fullWidth>
                  {p.cta.label}
                </Button>
              ) : (
                <Button href="#waitlist" variant={p.featured ? "slab" : "outline"} fullWidth>
                  Join the waitlist
                </Button>
              )}
            </div>
          </Card>
        ))}
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

      <section id="waitlist" aria-labelledby="wl" className="mt-16 scroll-mt-24">
        <Card padding="lg" className="mx-auto max-w-xl">
          <h2 id="wl" className="font-display text-3xl font-bold uppercase text-ink">
            Get Pro first
          </h2>
          <p className="mb-5 mt-1 text-sm text-ink-2">One email when it opens. Nothing else.</p>
          <WaitlistForm source="pricing" />
        </Card>
      </section>

      <div className="mt-16">
        <Prose>
          <h2>The fine print, plainly</h2>
          <ul>
            <li>Prices are in USD and may change before launch. Nothing is billed today; there&apos;s no payment form on this site yet.</li>
            <li>A &ldquo;verdict&rdquo; is one card run through the full fee-and-odds math. Centering checks and lookups don&apos;t count.</li>
            <li>Paid plans won&apos;t change the math. Free and Pro users get the same honest answer; Pro just gets more of them.</li>
          </ul>
        </Prose>
      </div>
    </PageShell>
  );
}
