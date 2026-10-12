import type { Metadata } from "next";
import { PageShell } from "@/components/brand/Prose";
import { ClaimPurchase } from "@/components/billing/ClaimPurchase";

export const metadata: Metadata = {
  title: "Thanks",
  robots: { index: false, follow: false },
};

export default async function PricingSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  return (
    <PageShell eyebrow="Checkout" title="Paid. Now go sleeve things.">
      <ClaimPurchase sessionId={sessionId} />
    </PageShell>
  );
}
