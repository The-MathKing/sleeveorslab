import type { Metadata } from "next";
import { PageShell } from "@/components/brand/Prose";
import { PricingView } from "@/components/billing/PricingView";
import { FREE_VERDICTS_PER_DAY, PLANS } from "@/lib/billing/plans";

const pro = PLANS["pro-monthly"];
const pack = PLANS["pack-100"];

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free: card lookup, centering, and ${FREE_VERDICTS_PER_DAY} verdicts a day. Pro is ${pro.price}${pro.per.replace("/ ", "/")}, or ${pack.credits} scans for ${pack.price} once.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <PageShell
      eyebrow="Pricing"
      title="Cheaper than one bad submission."
      lede="One avoided grading fee pays for most of a year of Pro. The free tier covers most collectors, and that's on purpose."
      wide
    >
      <PricingView />
    </PageShell>
  );
}
