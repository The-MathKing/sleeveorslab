// Canonical public origin for metadata, sitemap, and share links (server side).
// Order: explicit NEXT_PUBLIC_SITE_URL → Vercel's production domain → localhost in dev → the real domain.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://www.sleeveorslab.com")
).replace(/\/+$/, "");
