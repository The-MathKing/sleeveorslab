/**
 * Static-color SVG strings of the marks, for places CSS variables can't reach:
 * next/og ImageResponse (apple-icon, OG image), and the PNG icon generator.
 * Geometry must match Logomark.tsx.
 */
export const BRAND_HEX = {
  paper: "#f6f4ee",
  paper2: "#ece9e0",
  ink: "#15171c",
  ink2: "#474c58",
  ink3: "#7c818d",
  line: "#dcd8cc",
  sleeve: "#5b7a99",
  sleeveSoft: "#e3eaf1",
  sleeveDeep: "#3f5d7c",
  slab: "#c9971c",
  slabSoft: "#f8edd0",
  slabDeep: "#9c7008",
  borderline: "#d9741e",
  good: "#2f8f5b",
  bad: "#c0392b",
} as const;

export function logomarkSvg(): string {
  const C = BRAND_HEX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 96" width="72" height="96">
  <defs>
    <clipPath id="l"><rect x="0" y="0" width="36" height="96"/></clipPath>
    <clipPath id="r"><rect x="36" y="0" width="36" height="96"/></clipPath>
  </defs>
  <g clip-path="url(#l)">
    <rect x="4.5" y="4" width="63" height="88" rx="6" fill="${C.sleeveSoft}"/>
    <rect x="4.5" y="4" width="63" height="88" rx="6" fill="${C.sleeve}" opacity="0.22"/>
    <rect x="4.5" y="4" width="63" height="9" rx="3" fill="${C.sleeve}" opacity="0.28"/>
    <path d="M10 92 L30 4 L35 4 L15 92 Z" fill="#fff" opacity="0.35"/>
    <rect x="4.5" y="4" width="63" height="88" rx="6" fill="none" stroke="${C.sleeve}" stroke-width="2.5"/>
  </g>
  <g clip-path="url(#r)">
    <rect x="4.5" y="4" width="63" height="88" rx="6" fill="${C.slabSoft}"/>
    <rect x="4.5" y="4" width="63" height="15" rx="4" fill="${C.slab}"/>
    <rect x="40" y="9" width="14" height="2.4" rx="1.2" fill="${C.slabSoft}" opacity="0.9"/>
    <rect x="40" y="13" width="9" height="2.4" rx="1.2" fill="${C.slabSoft}" opacity="0.7"/>
    <rect x="56" y="8.5" width="7" height="7" rx="1.5" fill="${C.slabSoft}" opacity="0.95"/>
    <rect x="4.5" y="4" width="63" height="88" rx="6" fill="none" stroke="${C.slab}" stroke-width="4"/>
  </g>
  <rect x="13.3" y="24" width="47" height="60" rx="2" fill="none" stroke="${C.ink}" stroke-width="2.25"/>
  <line x1="36" y1="4" x2="36" y2="92" stroke="${C.ink}" stroke-width="1.25" stroke-dasharray="3 2.5"/>
  <line x1="4.5" y1="54" x2="67.5" y2="54" stroke="${C.ink}" stroke-width="1.25" stroke-dasharray="3 2.5" opacity="0.55"/>
  <circle cx="36" cy="54" r="5" fill="none" stroke="${C.ink}" stroke-width="1.5"/>
</svg>`;
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
