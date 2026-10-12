import type { Metadata } from "next";
import { Collection } from "@/components/scan/Collection";
import { PageHeader } from "@/components/scan/parts";

export const metadata: Metadata = {
  title: "Saved cards",
  description: "Cards you've scanned and saved. Stored on this device only.",
};

export default function CollectionPage() {
  return (
    <>
      <PageHeader title="Saved cards" kicker="On this device">
        Your scans live in this browser, photos included. Nothing is uploaded. Re-run any card when prices move.
      </PageHeader>
      <Collection />
    </>
  );
}
