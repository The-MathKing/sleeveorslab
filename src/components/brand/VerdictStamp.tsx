"use client";

import { useId, type CSSProperties } from "react";
import { clsx } from "clsx";
import type { Verdict } from "@/lib/types";

export type VerdictStampSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface VerdictStampProps {
  verdict: Verdict;
  /** Preset size or explicit width in px. Default "md" (220px wide). */
  size?: VerdictStampSize | number;
  /** Play the "thunk" entrance on mount. Ignored under prefers-reduced-motion. */
  animate?: boolean;
  /** Delay before the thunk, ms. */
  delayMs?: number;
  /** Rotation in degrees. Defaults per verdict so a page of stamps looks hand-applied. */
  rotate?: number;
  /** Small line printed under the main text, e.g. "EV −$38.20". Keep it short. */
  caption?: string;
  /** Lay a faint paper patch behind the ink so it reads over busy art. */
  backing?: boolean;
  className?: string;
}

const WIDTHS: Record<VerdictStampSize, number> = { xs: 96, sm: 150, md: 220, lg: 300, xl: 380 };

export const VERDICT_COPY: Record<Verdict, { text: string; ink: string; spoken: string; kicker: string }> = {
  SLEEVE: { text: "SLEEVE IT.", ink: "var(--sleeve-deep)", spoken: "Sleeve it", kicker: "KEEP IT RAW" },
  SLAB: { text: "SLAB IT.", ink: "var(--slab-deep)", spoken: "Slab it", kicker: "WORTH THE FEE" },
  BORDERLINE: { text: "BORDERLINE", ink: "var(--borderline)", spoken: "Borderline", kicker: "COIN FLIP" },
};

const DEFAULT_ROT: Record<Verdict, number> = { SLEEVE: -6, SLAB: -4, BORDERLINE: -8 };

/**
 * Rubber-stamp verdict badge. Texture is an SVG filter: low-frequency
 * turbulence warps the edges, high-frequency turbulence punches ink voids.
 * Exposed to assistive tech as a single image named "Verdict: Sleeve it".
 */
export function VerdictStamp({
  verdict,
  size = "md",
  animate = false,
  delayMs = 120,
  rotate,
  caption,
  backing = false,
  className,
}: VerdictStampProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterId = `stamp-ink-${id}`;
  const copy = VERDICT_COPY[verdict];
  const width = typeof size === "number" ? size : WIDTHS[size];
  const height = Math.round(width * (caption ? 0.5 : 0.42));
  const vbH = caption ? 160 : 134;
  const rot = rotate ?? DEFAULT_ROT[verdict];
  // Small sizes get less distortion so the text stays crisp.
  const roughness = width < 140 ? 1.5 : 3.2;

  return (
    <span
      role="img"
      aria-label={`Verdict: ${copy.spoken}${caption ? `. ${caption}` : ""}`}
      className={clsx("stamp inline-block select-none", animate && "stamp-thunk", className)}
      style={{ "--stamp-rot": `${rot}deg`, "--stamp-delay": `${delayMs}ms`, color: copy.ink } as CSSProperties}
    >
      <svg viewBox={`0 0 320 ${vbH}`} width={width} height={height} aria-hidden="true" overflow="visible">
        <defs>
          <filter id={filterId} x="-5%" y="-10%" width="110%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="warp" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale={roughness}
              xChannelSelector="R"
              yChannelSelector="G"
              result="rough"
            />
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="11" result="grain" />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.2 0 0 0 2.05"
              result="grainAlpha"
            />
            <feComposite in="rough" in2="grainAlpha" operator="in" />
          </filter>
        </defs>
        {backing && <rect x="2" y="2" width="316" height={vbH - 4} rx="16" className="fill-paper" opacity="0.88" />}
        <g filter={`url(#${filterId})`} fill="currentColor" stroke="currentColor">
          <rect x="6" y="6" width="308" height={vbH - 12} rx="14" fill="none" strokeWidth="7" />
          <rect x="17" y="17" width="286" height={vbH - 34} rx="8" fill="none" strokeWidth="2.25" />
          <text
            x="160"
            y="38"
            textAnchor="middle"
            stroke="none"
            style={{ fontFamily: "var(--font-mono-face), ui-monospace, monospace" }}
            fontSize="13"
            fontWeight="700"
            letterSpacing="4"
          >
            ★ {copy.kicker} ★
          </text>
          <text
            x="160"
            y={caption ? 100 : 106}
            textAnchor="middle"
            stroke="none"
            style={{ fontFamily: "var(--font-display-face), 'Arial Narrow', sans-serif" }}
            fontSize="64"
            fontWeight="800"
            textLength="262"
            lengthAdjust="spacingAndGlyphs"
          >
            {copy.text}
          </text>
          {caption && (
            <text
              x="160"
              y="132"
              textAnchor="middle"
              stroke="none"
              style={{ fontFamily: "var(--font-mono-face), ui-monospace, monospace" }}
              fontSize="15"
              fontWeight="700"
              letterSpacing="1"
            >
              {caption}
            </text>
          )}
        </g>
      </svg>
    </span>
  );
}
