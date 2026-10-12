// llms.txt (https://llmstxt.org): a plain-markdown map of the site for AI assistants.
// Built from the live fee table, tolerances, and plans so it never drifts from the app.
import { PLANS } from "@/lib/billing/plans";
import { formatRatio } from "@/lib/centering/format";
import { FEES_LAST_VERIFIED, getTiers, TOLERANCES } from "@/lib/grading";
import { SITE_URL } from "@/lib/site";
import { FAQ, SITE_NAME, SUMMARY, TAGLINE } from "./index";

const u = (p: string) => `${SITE_URL}${p}`;

function pages(): string {
  return `## Tools
- [Scan a card](${u("/scan")}): photo → centering → card search → condition check → expected-value verdict for PSA and CGC
- [Binder triage](${u("/binder")}): paste a list of cards, get them ranked by expected grading profit
- [Receipts](${u("/receipts")}): public, timestamped log of predictions made before grades come back, misses included ([RSS](${u("/receipts/feed.xml")}))

## Reference
- [Grading fees](${u("/fees")}): current PSA and CGC tiers, prices, declared-value caps, turnaround
- [How it works](${u("/how-it-works")}): the method, assumptions, and limitations
- [Pricing](${u("/pricing")}): free tier and paid plans

## Optional
- [Privacy](${u("/privacy")}), [Terms](${u("/terms")}), [Disclaimer](${u("/disclaimer")})
- [Full version of this file](${u("/llms-full.txt")})`;
}

export function llmsTxt(): string {
  return `# ${SITE_NAME}

> ${TAGLINE} ${SUMMARY}

Key facts:
- Free to use in any browser; installable as an app. No account needed.
- Photos are processed on the user's device and never uploaded.
- Not affiliated with PSA, CGC, Nintendo, or The Pokémon Company. Outputs are estimates, not financial advice and not a promised grade.
- Usual answer: most modern raw cards lose money when graded at current fees; the app says so ("Sleeve it").

${pages()}
`;
}

function feeTable(): string {
  const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tiers = getTiers();
  const rows = tiers
    .filter((t) => t.available)
    .map((t) => {
      const cap = t.maxDeclaredValueUsd ? `$${t.maxDeclaredValueUsd.toLocaleString("en-US")}` : "—";
      const [lo, hi] = t.turnaroundBusinessDays;
      const days = lo === hi ? `${lo}` : `${lo}–${hi}`;
      const fee = `${usd(t.feeUsd)}${t.minCards && t.minCards > 1 ? ` (min ${t.minCards} cards)` : ""}`;
      return `| ${t.grader} | ${t.name} | ${fee} | ${cap} | ${days} |`;
    });
  const paused = tiers.filter((t) => !t.available).map((t) => t.name);
  return `| Grader | Tier | Fee per card | Max declared value | Turnaround (business days) |
|---|---|---|---|---|
${rows.join("\n")}${paused.length ? `\n\nCurrently paused by the grader: ${paused.join(", ")}.` : ""}`;
}

function toleranceTable(): string {
  const rows = TOLERANCES.PSA.map((r) => {
    const cgc = TOLERANCES.CGC.find((c) => c.grade === r.grade);
    return `| ${r.grade} | ${formatRatio(r.front)} | ${formatRatio(r.back)} | ${cgc ? `${formatRatio(cgc.front)} / ${formatRatio(cgc.back)}` : "—"} |`;
  });
  return `| Grade | PSA front | PSA back | CGC front / back |
|---|---|---|---|
${rows.join("\n")}`;
}

export function llmsFullTxt(): string {
  const plans = Object.values(PLANS)
    .map((p) => `- **${p.name}** — ${p.price}${p.priceCents ? ` ${p.per}` : ""}: ${p.features.join("; ")}`)
    .join("\n");
  return `${llmsTxt()}
## How the verdict is calculated
1. **Centering** is measured from a straight-on photo: the border widths on each side give left/right and top/bottom ratios (e.g. 55/45). Each grader's tolerances cap the best possible grade.
2. **Grade distribution**: a prior for how often cards of that era and finish receive a 10 (an estimate, not population-report data), shifted by the user's own condition check and capped by centering.
3. **Prices**: raw market price, and graded prices by grade (sales data when available, otherwise labelled estimates).
4. **Expected value** = Σ P(grade) × graded price × (1 − 13% selling fees), minus the grading fee, about $6 round-trip shipping, and price drift over the turnaround, compared against selling the card raw.
5. **Verdict**: "Slab it" when expected profit is clearly positive and the chance of losing money is under 50%; "Sleeve it" when expected profit is negative; otherwise "Borderline".

## Centering tolerances (larger share / smaller share)
${toleranceTable()}

CGC Pristine 10 requires essentially perfect 50/50 centering on both sides.

## Grading fees (checked ${FEES_LAST_VERIFIED}; confirm on the grader's site before submitting)
${feeTable()}

## Plans
${plans}

## FAQ
${FAQ.map(({ q, a }) => `### ${q}\n${a}`).join("\n\n")}

## Contact
hello@sleeveorslab.com · Instagram @sleeveorslab
`;
}
