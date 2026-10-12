import type { Metadata } from "next";
import { PageShell } from "@/components/brand/Prose";
import { RestorePurchase } from "@/components/billing/RestorePurchase";

export const metadata: Metadata = {
  title: "Restore purchase",
  description: "Bring your Pro plan or scan credits to a new phone or browser. No account needed.",
  alternates: { canonical: "/pricing/restore" },
};

export default async function PricingRestorePage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : null;
  return (
    <PageShell
      eyebrow="Restore purchase"
      title="New phone? Same plan."
      lede="There are no accounts here. Your purchase lives in your browser, and your checkout email is the key to bring it somewhere new."
    >
      <RestorePurchase restoreToken={token} />
    </PageShell>
  );
}
