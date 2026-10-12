import type { CSSProperties } from "react";
import { cn } from "@/components/ui/cn";

export interface CardArtProps {
  /** Left border share, 0.5..0.8. 0.55 means 55/45. */
  leftShare?: number;
  /** Wrap the card in a penny sleeve. */
  sleeved?: boolean;
  /** Draw the dashed centering guides + border measurements. */
  guides?: boolean;
  name?: string;
  number?: string;
  className?: string;
  /** Width in px; height follows 63:88. Defaults to filling the container. */
  width?: number;
}

/**
 * A generic, IP-free trading card drawn in CSS: warm border, foil-ish art box,
 * and an inner frame that can be pushed off-center to show centering.
 */
export function CardArt({
  leftShare = 0.55,
  sleeved = true,
  guides = false,
  name = "Example Holo",
  number = "199/197",
  className,
  width,
}: CardArtProps) {
  const totalH = 9; // % of card width used by left+right borders combined
  const left = totalH * leftShare;
  const right = totalH - left;
  return (
    <div
      className={cn("relative aspect-[63/88] select-none", className)}
      style={width ? { width } : undefined}
      aria-hidden="true"
    >
      {/* Card stock */}
      <div className="absolute inset-0 rounded-[4.5%/3.2%] bg-[#e9c64a] shadow-[0_1px_0_rgb(0_0_0/0.15),0_12px_30px_-12px_rgb(0_0_0/0.45)]">
        <div
          className="absolute rounded-[3%] bg-[#f7f1df]"
          style={{ left: `${left}%`, right: `${right}%`, top: "3.6%", bottom: "3.6%" } as CSSProperties}
        >
          <div className="flex h-full flex-col p-[5%] text-[#2a2410]">
            <div className="flex items-baseline justify-between font-display text-[clamp(0.55rem,4.2cqw,1rem)] font-extrabold uppercase leading-none">
              <span className="truncate">{name}</span>
              <span className="font-mono text-[0.75em]">HP 210</span>
            </div>
            <div
              className="mt-[4%] aspect-[4/3] w-full rounded-[2%] ring-2 ring-[#c79f2e]"
              style={{
                background:
                  "radial-gradient(120% 90% at 30% 20%, #ffe9a8 0%, transparent 45%), radial-gradient(90% 80% at 80% 90%, #7fb7d9 0%, transparent 55%), conic-gradient(from 200deg at 60% 55%, #f6b26b, #e86f5a, #9a6fd6, #5aa7e8, #6fd6a8, #f6e36b, #f6b26b)",
              }}
            />
            <div className="mt-[5%] flex flex-1 flex-col gap-[6%]">
              <div className="h-[9%] w-[85%] rounded-sm bg-[#2a2410]/15" />
              <div className="h-[9%] w-[70%] rounded-sm bg-[#2a2410]/10" />
              <div className="h-[9%] w-[78%] rounded-sm bg-[#2a2410]/10" />
            </div>
            <div className="flex justify-between font-mono text-[clamp(0.4rem,2.6cqw,0.65rem)] text-[#2a2410]/70">
              <span>Illus. Example</span>
              <span>{number}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Penny sleeve: oversize, clear, with an open lip at the top */}
      {sleeved && (
        <div className="pointer-events-none absolute -inset-x-[3.5%] -bottom-[2.5%] -top-[5%] rounded-[4%/2.6%] border border-white/60 bg-[linear-gradient(115deg,rgb(255_255_255/0.05)_0_35%,rgb(255_255_255/0.4)_42%,rgb(255_255_255/0.06)_50%_100%)] ring-1 ring-sleeve/30">
          <div className="absolute inset-x-0 top-0 h-[3.5%] rounded-t-[inherit] bg-sleeve/15" />
        </div>
      )}

      {guides && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-[-4%] left-1/2 border-l-[1.5px] border-dashed border-ink/70" />
          <div
            className="absolute inset-y-[-4%] border-l-[1.5px] border-bad/80"
            style={{ left: `${left + (100 - left - right) / 2}%` }}
          />
        </div>
      )}
    </div>
  );
}
