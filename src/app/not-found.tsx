import type { Metadata } from "next";
import { ArrowRight, SearchX } from "lucide-react";
import { Button, Container, EmptyState, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This card isn't in the binder. The page you're looking for doesn't exist or has moved.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <Container size="sm" className="py-12 sm:py-20">
      <Eyebrow className="mb-3">404</Eyebrow>
      <h1 className="mb-8 font-display text-[clamp(2.1rem,7vw,3.4rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-ink text-balance">
        This card isn&apos;t in the binder.
      </h1>
      <EmptyState
        icon={<SearchX aria-hidden="true" />}
        title="Empty slot"
        description="The page you're looking for doesn't exist, or it moved. If you followed a receipt link, double-check the id."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button href="/scan" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
              Check a card
            </Button>
            <Button href="/" variant="outline">
              Back to home
            </Button>
          </div>
        }
      />
    </Container>
  );
}
