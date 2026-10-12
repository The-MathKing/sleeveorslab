// RSS 2.0 feed of public predictions: every call, logged before the grade comes back.
import { listPredictions } from "@/lib/db";
import { SITE_NAME } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const VERDICT_TEXT = { SLAB: "Slab it", SLEEVE: "Sleeve it", BORDERLINE: "Borderline" } as const;

function item(p: Prediction): string {
  const url = `${SITE_URL}/receipts/${p.id}`;
  const p10 = Math.round((p.distribution[10] ?? 0) * 100);
  const money = `${p.expectedProfitUsd >= 0 ? "+" : "−"}$${Math.abs(p.expectedProfitUsd).toFixed(2)}`;
  const card = `${p.card.name} ${p.card.number} (${p.card.setName})`;
  const outcome = p.outcome ? ` Result: ${p.grader} ${p.outcome.grade}${p.outcome.certNumber ? `, cert ${p.outcome.certNumber}` : ""}.` : " Result: pending.";
  const desc = `${VERDICT_TEXT[p.verdict]} with ${p.grader}. Expected profit vs selling raw: ${money}. Chance of a 10: ${p10}%.${outcome}`;
  return `    <item>
      <title>${esc(`${p.id}: ${card} — ${VERDICT_TEXT[p.verdict]}`)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
}

export async function GET() {
  let predictions: Prediction[] = [];
  try {
    predictions = await listPredictions({ publicOnly: true, limit: 50 });
  } catch {
    // An empty feed beats an error page for feed readers.
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`${SITE_NAME} — Receipts`)}</title>
    <link>${SITE_URL}/receipts</link>
    <atom:link href="${SITE_URL}/receipts/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Every grading prediction, published before the grade comes back. Misses included.</description>
    <language>en-us</language>
    <ttl>60</ttl>
${predictions.map(item).join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" },
  });
}
