import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanFlow } from "@/components/scan/ScanFlow";
import { Skeleton } from "@/components/scan/parts";

export const metadata: Metadata = {
  title: "Scan a card",
  description: "Measure centering from a photo, check condition, and get an honest grade-or-don't verdict with the math shown.",
};

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <ScanFlow />
    </Suspense>
  );
}
