import type { SVGProps } from "react";

type MarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Rendered height in px (width follows the 63:88 card aspect plus guides). */
  size?: number;
  /** Accessible name. Pass "" to mark as decorative. */
  title?: string;
};

/**
 * Full logomark: a trading card at true 63:88 aspect. The left half is a penny
 * sleeve (translucent blue-gray plastic with an open lip), the right half is a
 * slab (gold frame + label). The inner art frame sits 55/45 off-center, and a
 * dashed centering guide marks the true center. Use at 24px and up; below that
 * use <LogomarkSimple />.
 *
 * Colors come from CSS tokens, so it adapts to dark mode automatically.
 */
export function Logomark({ size = 40, title = "Sleeve or Slab", className, ...rest }: MarkProps) {
  const w = (size * 72) / 96;
  const decorative = title === "";
  return (
    <svg
      viewBox="0 0 72 96"
      width={w}
      height={size}
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      {...rest}
    >
      {!decorative && <title>{title}</title>}
      <defs>
        <clipPath id="sos-mark-left">
          <rect x="0" y="0" width="36" height="96" />
        </clipPath>
        <clipPath id="sos-mark-right">
          <rect x="36" y="0" width="36" height="96" />
        </clipPath>
      </defs>

      {/* SLEEVE half: translucent plastic over the card */}
      <g clipPath="url(#sos-mark-left)">
        <rect className="fill-sleeve-soft" x="4.5" y="4" width="63" height="88" rx="6" />
        <rect className="fill-sleeve" x="4.5" y="4" width="63" height="88" rx="6" opacity="0.22" />
        {/* open sleeve lip */}
        <rect className="fill-sleeve" x="4.5" y="4" width="63" height="9" rx="3" opacity="0.28" />
        {/* plastic sheen */}
        <path d="M10 92 L30 4 L35 4 L15 92 Z" fill="#fff" opacity="0.35" />
        <rect className="stroke-sleeve" x="4.5" y="4" width="63" height="88" rx="6" fill="none" strokeWidth="2.5" />
      </g>

      {/* SLAB half: gold frame with a label strip */}
      <g clipPath="url(#sos-mark-right)">
        <rect className="fill-slab-soft" x="4.5" y="4" width="63" height="88" rx="6" />
        <rect className="fill-slab" x="4.5" y="4" width="63" height="15" rx="4" />
        <rect className="fill-slab-soft" x="40" y="9" width="14" height="2.4" rx="1.2" opacity="0.9" />
        <rect className="fill-slab-soft" x="40" y="13" width="9" height="2.4" rx="1.2" opacity="0.7" />
        <rect className="fill-slab-soft" x="56" y="8.5" width="7" height="7" rx="1.5" opacity="0.95" />
        <rect className="stroke-slab" x="4.5" y="4" width="63" height="88" rx="6" fill="none" strokeWidth="4" />
      </g>

      {/* Inner art frame, deliberately 55/45 left-right (8.8 : 7.2 border) */}
      <rect className="stroke-ink" x="13.3" y="24" width="47" height="60" rx="2" fill="none" strokeWidth="2.25" />

      {/* Centering guides */}
      <line className="stroke-ink" x1="36" y1="0" x2="36" y2="96" strokeWidth="1.25" strokeDasharray="3 2.5" />
      <line className="stroke-ink" x1="0" y1="54" x2="72" y2="54" strokeWidth="1.25" strokeDasharray="3 2.5" opacity="0.55" />
      <circle className="stroke-ink" cx="36" cy="54" r="5" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Favicon-grade mark for 16–24px: card silhouette split sleeve/slab with a
 * single off-center inner frame. No dashes, no label detail.
 */
export function LogomarkSimple({ size = 20, title = "Sleeve or Slab", className, ...rest }: MarkProps) {
  const decorative = title === "";
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      {...rest}
    >
      {!decorative && <title>{title}</title>}
      <path className="fill-sleeve" d="M8.5 2.5 H16 V29.5 H8.5 A2.5 2.5 0 0 1 6 27 V5 A2.5 2.5 0 0 1 8.5 2.5 Z" />
      <path className="fill-slab" d="M16 2.5 H23.5 A2.5 2.5 0 0 1 26 5 V27 A2.5 2.5 0 0 1 23.5 29.5 H16 Z" />
      <rect className="stroke-card" x="10" y="9" width="13" height="16.5" rx="1" fill="none" strokeWidth="2" />
      <rect className="stroke-ink" x="6" y="2.5" width="20" height="27" rx="2.5" fill="none" strokeWidth="1.5" />
    </svg>
  );
}
