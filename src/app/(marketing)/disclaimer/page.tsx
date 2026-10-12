import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Callout, PageShell, Prose } from "@/components/brand/Prose";

export const metadata: Metadata = pageMetadata("/disclaimer", "Disclaimer", "Estimates, not financial advice. Not affiliated with PSA, CGC, Nintendo, or The Pokémon Company.");

export default function DisclaimerPage() {
  return (
    <PageShell
      eyebrow="Disclaimer"
      title="Estimates, not promises."
      lede="We'd rather you read this once than be surprised later."
      updated="October 12, 2026"
    >
      <Prose>
        <Callout title="The footer line, expanded" tone="borderline">
          <p>
            Estimates, not financial advice. Not affiliated with PSA, CGC, Nintendo, or The Pokémon Company.
          </p>
        </Callout>

        <h2>Grades are estimates</h2>
        <p>
          When we show a grade, it&apos;s a <strong>PSA-style or CGC-style grade estimate</strong>: our probability for each
          grade on that company&apos;s scale. It is not a grade from that company, and we can&apos;t tell you what any grader will
          actually assign. Surface flaws, in particular, are often invisible in photos.
        </p>

        <h2>Prices are estimates</h2>
        <p>
          Raw and graded prices come from third-party data and can be stale, thin, or wrong. When we don&apos;t have sales data for
          a graded price, we model it, and label it &ldquo;estimate.&rdquo; Markets move, especially during long grading queues.
        </p>

        <h2>Fees can change</h2>
        <p>
          Grading companies change their prices, tiers and declared-value limits often. Our <Link href="/fees">fee table</Link>{" "}
          shows when we last checked. Confirm on the grader&apos;s own site before you submit.
        </p>

        <h2>Not financial advice</h2>
        <p>
          Cards are collectibles, not investments we can advise on. Nothing here is a recommendation to buy, sell, hold, or
          grade any card. Expected value is an average across many outcomes, so a single card can do much better or much worse.
        </p>

        <h2>Not affiliated</h2>
        <p>
          Sleeve or Slab is independent and is not affiliated with, endorsed by, or sponsored by PSA (Professional Sports
          Authenticator / Collectors Universe), CGC (Certified Guaranty Company), Nintendo, The Pokémon Company, Creatures, or
          Game Freak. Pokémon and card names are trademarks of their respective owners.
        </p>

        <h2>Our track record is public</h2>
        <p>
          We log predictions before grades come back on <Link href="/receipts">Receipts</Link>, so you can judge how much to
          trust us from our results.
        </p>
      </Prose>
    </PageShell>
  );
}
