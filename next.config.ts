import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy, built from an audit of everything the app loads:
 *
 * - Next.js App Router injects inline <script> tags (RSC payload, bootstrap). Without per-request
 *   nonces (which would force every page to render dynamically) script-src needs 'unsafe-inline'.
 * - next/font is self-hosted under /_next/static/media → font-src 'self'.
 * - React `style={...}` attributes, next/font and Tailwind → style-src 'unsafe-inline'.
 * - Card art is hot-linked from images.pokemontcg.io; photo thumbnails are data: URLs and
 *   object URLs (blob:) from canvas/File → img-src.
 * - Camera preview uses getUserMedia + video.srcObject (not governed by media-src); blob:/mediastream:
 *   are allowed anyway for safety.
 * - tesseract.js v7 OCR (src/components/scan/ocr.ts, default options): spawns a Worker from a blob: URL
 *   that importScripts() worker.min.js and tesseract-core-*.wasm.js from cdn.jsdelivr.net (the wasm
 *   binary is embedded in that script, then WebAssembly.instantiate → 'wasm-unsafe-eval'), and fetches
 *   eng.traineddata from cdn.jsdelivr.net/npm/@tesseract.js-data. Blob workers inherit this policy.
 *   (v7 no longer uses tessdata.projectnaptha.com.)
 * - Service worker /sw.js is same-origin and only fetches same-origin → worker-src 'self', connect-src 'self'.
 * - All client fetches go to /api/* (same origin). pokemontcg.io / PriceCharting / Google Fonts (OG image)
 *   are fetched server-side and are not subject to CSP.
 * - Dev only: React Refresh needs 'unsafe-eval', HMR needs a websocket.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.pokemontcg.io",
  "font-src 'self' data:",
  `connect-src 'self' https://cdn.jsdelivr.net${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * Shipped as Report-Only for launch: violations are logged in the browser console without blocking,
 * so a missed source can't break scanning/OCR. After checking /scan (camera + OCR), /binder and a
 * receipt page in production with no violations, set CSP_ENFORCE=1 to switch to the enforced header.
 * Clickjacking protection does not depend on this: X-Frame-Options: DENY is always sent
 * (frame-ancestors is ignored in Report-Only mode).
 */
const cspHeader = process.env.CSP_ENFORCE === "1" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: cspHeader, value: csp },
];

const nextConfig: NextConfig = {
  // next/image is not used (card art is plain <img>), so no `images.remotePatterns` needed.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
