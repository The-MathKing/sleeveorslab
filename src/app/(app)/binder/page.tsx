import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Binder } from "@/components/scan/Binder";
import { PageHeader } from "@/components/scan/parts";

export const metadata: Metadata = pageMetadata("/binder", "Binder triage", "Rank a stack of raw cards by expected grading profit. Most of them belong in a sleeve.");

export default function BinderPage() {
  return (
    <>
      <PageHeader title="Binder triage" kicker="Batch">
        Dump the whole stack in. We rank it by expected profit and tell you which few are worth the fee.
      </PageHeader>
      <Binder />
    </>
  );
}
