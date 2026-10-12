"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Container, EmptyState, Eyebrow } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container size="sm" className="py-12 sm:py-20">
      <Eyebrow className="mb-3">Something went wrong</Eyebrow>
      <h1 className="mb-8 font-display text-[clamp(2.1rem,7vw,3.4rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-ink text-balance">
        That one slipped out of the sleeve.
      </h1>
      <EmptyState
        icon={<TriangleAlert aria-hidden="true" />}
        title="We hit a snag"
        description={
          <>
            Nothing you scanned has left your device. Try again, and if it keeps happening, reload the page.
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs text-ink-3">Ref: {error.digest}</span>
            ) : null}
          </>
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => reset()} iconLeft={<RotateCcw className="size-4" aria-hidden="true" />}>
              Try again
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
