import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ReceiptsLog } from "@/components/scan/ReceiptsLog";
import { PageHeader } from "@/components/scan/parts";

export const metadata: Metadata = pageMetadata("/receipts", "Receipts: every prediction, before the grade", "A public, timestamped log of Sleeve or Slab predictions, checked against real grades. Misses included.");

export default function ReceiptsPage() {
  return (
    <>
      <PageHeader title="Receipts" kicker="Public prediction log">
        We publish every prediction before the grade comes back, including misses. Each receipt is timestamped when it&apos;s
        logged; the grade is added later and the prediction can&apos;t be edited. Card and verdict only, never photos or
        names.
      </PageHeader>
      <ReceiptsLog />
    </>
  );
}
