import type { ReactNode } from "react";
import { ScanLine, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CardArt } from "./CardArt";

/** Bounded frame on the landing page for the live centering demo (see LiveCenteringDemo). */
export function LiveDemoSlot({ tool }: { tool?: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[calc(var(--radius)+6px)] border border-line bg-card p-2 shadow-lift"
      data-slot="live-centering-demo"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 pb-2 pt-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
        <span className="size-2 rounded-full bg-good" aria-hidden="true" />
        Live centering check · runs on your device
      </div>
      <div className="p-2 sm:p-4">{tool ?? <LiveDemoFallback />}</div>
    </div>
  );
}

export function LiveDemoFallback({ loading = false }: { loading?: boolean }) {
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[11rem_1fr]">
      <div className="mx-auto w-40 [container-type:inline-size]">
        <CardArt leftShare={0.58} guides sleeved={false} name="Your card" number="???/???" />
      </div>
      <div className="flex flex-col gap-3 text-center sm:text-left">
        <h3 className="font-display text-2xl font-bold uppercase leading-tight text-ink">
          {loading ? "Loading the ruler…" : "Measure your own card"}
        </h3>
        <p className="text-sm text-ink-2">
          Snap the front, drag the guides to the border edges, and get the left/right and top/bottom split.
          Your photo stays on your phone. We never upload it.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-2">
          <li className="flex items-center gap-2 max-sm:justify-center">
            <Smartphone className="size-4 text-sleeve" aria-hidden="true" /> Works best flat, in daylight, no sleeve glare
          </li>
        </ul>
        <div className="max-sm:mx-auto">
          <Button href="/scan" variant="primary" iconLeft={<ScanLine className="size-4" aria-hidden="true" />}>
            Check centering
          </Button>
        </div>
      </div>
    </div>
  );
}
