// Search + AI-assistant discoverability: per-page metadata, JSON-LD, and the facts that
// llms.txt is built from. Keep this factual; it is quoted by assistants as-is.
import type { Metadata } from "next";
import { FREE_VERDICTS_PER_DAY, PLANS } from "@/lib/billing/plans";
import { SITE_URL } from "@/lib/site";

export const SITE_NAME = "Sleeve or Slab";
export const TAGLINE = "The app that tells you when not to grade.";
export const SUMMARY =
  "Sleeve or Slab is a free web app for Pokémon card collectors that answers one question: is this raw card worth paying to grade at PSA or CGC? It measures centering from a phone photo on-device, looks up raw and graded prices, applies current grading fees and turnaround, and returns an expected-value verdict (Slab it, Sleeve it, or Borderline) with every assumption shown.";

/** Canonical URL + Open Graph/Twitter for a page, on top of the root layout defaults. */
/** Advertised on every page so feed readers and crawlers find the public prediction log. */
export const RSS_ALTERNATE = { "application/rss+xml": [{ url: "/receipts/feed.xml", title: "Sleeve or Slab — Receipts" }] };

export function pageMetadata(path: string, title: string, description: string, extra: Metadata = {}): Metadata {
  const url = path === "/" ? "/" : path;
  const full = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: url, types: RSS_ALTERNATE, ...(extra.alternates ?? {}) },
    openGraph: { title: full, description, url, siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image", title: full, description },
    ...extra,
  };
}

/** Plain-text FAQ, mirrored from the landing page, for FAQPage JSON-LD and llms.txt. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Does Sleeve or Slab predict my card's grade?",
    a: "No. It estimates a range of likely grades from measured centering, your own condition check, and how cards from that era tend to grade. You get probabilities, never a promised grade.",
  },
  {
    q: "Is Sleeve or Slab affiliated with PSA or CGC?",
    a: "No. It is not affiliated with PSA, CGC, Nintendo, or The Pokémon Company. A \"PSA-style grade estimate\" means an estimate on PSA's scale, not PSA's opinion.",
  },
  {
    q: "Where do my card photos go?",
    a: "Nowhere. Centering is measured in your browser and photos never leave your device. If you log a verdict publicly, only the card and the verdict are stored, never the photo.",
  },
  {
    q: "Where do the prices come from?",
    a: "Raw prices come from public market data. Graded prices come from sales data when available; otherwise they are estimated and labelled \"estimate\".",
  },
  {
    q: "How do I know if a Pokémon card is worth grading?",
    a: "Compare the expected graded sale value (each possible grade's price times its probability, minus selling fees) against the raw price plus grading fee, shipping, and the price drift over the turnaround. Centering alone often caps a card below a 10: PSA 10 allows up to 55/45 on the front and 75/25 on the back. Sleeve or Slab runs this math for you.",
  },
  {
    q: "What if the prediction is wrong?",
    a: "Every public prediction is logged with a timestamp before the grade comes back, and results stay up whether they are right or wrong, on the Receipts page.",
  },
  {
    q: "Is it free?",
    a: `Card lookup, centering, and ${FREE_VERDICTS_PER_DAY} full verdicts a day are free. Pro is ${PLANS["pro-monthly"].price} a month for unlimited verdicts and batch binder triage, or a one-time ${PLANS["pack-100"].price} pack of ${PLANS["pack-100"].credits} scans.`,
  },
];

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    email: "hello@sleeveorslab.com",
    sameAs: ["https://www.instagram.com/sleeveorslab"],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: TAGLINE,
    publisher: { "@id": `${SITE_URL}/#org` },
    inLanguage: "en-US",
  };
}

export function softwareApplicationLd() {
  const offers = Object.values(PLANS).map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: (p.priceCents / 100).toFixed(2),
    priceCurrency: "USD",
    description: p.blurb,
    ...(p.billing === "subscription"
      ? { priceSpecification: { "@type": "UnitPriceSpecification", price: (p.priceCents / 100).toFixed(2), priceCurrency: "USD", unitCode: "MON" } }
      : {}),
  }));
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: `${SITE_URL}/scan`,
    description: SUMMARY,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web browser (iOS, Android, desktop); installable PWA",
    browserRequirements: "Requires a modern browser; camera optional",
    isAccessibleForFree: true,
    publisher: { "@id": `${SITE_URL}/#org` },
    featureList: [
      "Card centering measured from a phone photo, on-device",
      "Live camera with automatic capture",
      "PSA and CGC grading fee and turnaround comparison",
      "Expected-value verdict: Slab it, Sleeve it, or Borderline",
      "Batch binder triage ranked by expected profit",
      "Public, timestamped prediction log (Receipts)",
    ],
    offers,
  };
}

export function faqLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}
