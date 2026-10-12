"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { CardArt } from "./CardArt";

/** Plain-English centering read, mirroring how published guidelines are usually summarised. Rough on purpose. */
function readCentering(big: number): { tone: "slab" | "borderline" | "sleeve" | "bad"; title: string; body: string } {
  if (big <= 55)
    return {
      tone: "slab",
      title: "Centering won't block a 10",
      body: "Inside the common 55/45 front tolerance. Corners, edges and surface still have a say.",
    };
  if (big <= 60)
    return {
      tone: "borderline",
      title: "Grey zone for a 10",
      body: "Between 55/45 and 60/40, graders differ. CGC's Gem Mint asks for tighter than PSA's. Treat a 10 as a coin you can't see.",
    };
  if (big <= 65)
    return {
      tone: "sleeve",
      title: "Likely caps around a 9",
      body: "Past 60/40 a 10 is off the table at most graders. Run the math with the 10 removed.",
    };
  if (big <= 70) return { tone: "sleeve", title: "Likely caps around an 8", body: "The fee usually eats whatever an 8 adds over raw." };
  return { tone: "bad", title: "Likely a 7 or lower", body: "That's a binder card. Sleeve it and enjoy it." };
}

/** Interactive 55/45 explainer: drag the art frame and watch the grade ceiling move. */
export function CenteringExplainer() {
  const [big, setBig] = useState(57);
  const id = useId();
  const read = readCentering(big);
  const share = big / 100;
  return (
    <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,13rem)_1fr]">
      <div className="mx-auto w-[min(15rem,70vw)] [container-type:inline-size]">
        <CardArt leftShare={share} sleeved={false} guides name="Off-Center" number="055/045" />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <label htmlFor={id} className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Left / right border</span>
            <span className="font-mono text-3xl font-semibold tabular-nums text-ink">
              {big}
              <span className="text-ink-3">/</span>
              {100 - big}
            </span>
          </label>
          <input
            id={id}
            type="range"
            min={50}
            max={75}
            step={1}
            value={big}
            onChange={(e) => setBig(Number(e.target.value))}
            aria-valuetext={`${big} over ${100 - big}`}
            className="mt-3 h-2 w-full cursor-pointer accent-[var(--ink)]"
          />
          <div className="mt-1 flex justify-between font-mono text-[0.68rem] text-ink-3" aria-hidden="true">
            {[50, 55, 60, 65, 70, 75].map((n) => (
              <span key={n} className={n === 55 ? "font-semibold text-ink" : undefined}>
                {n}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-card p-4" aria-live="polite">
          <Badge tone={read.tone}>{read.title}</Badge>
          <p className="mt-2 text-sm text-ink-2">{read.body}</p>
        </div>
        <p className="text-xs text-ink-3">
          The red line is where the art frame&apos;s center actually sits; the dashed line is the card&apos;s true center.
          Thresholds are rounded from public grading guidelines and are approximate.
        </p>
      </div>
    </div>
  );
}
