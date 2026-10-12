import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Prose } from "@/components/brand/Prose";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Sleeve or Slab, in plain English.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms of use"
      title="The deal, in plain English."
      lede="By using Sleeve or Slab you agree to these terms. They're short because the product is simple."
      updated="October 12, 2026"
    >
      <Prose>
        <h2>What this is</h2>
        <p>
          Sleeve or Slab is a calculator. It estimates whether grading a trading card is likely to be worth the cost. It gives
          you estimates and the assumptions behind them. It doesn&apos;t grade cards, buy cards, sell cards, or submit anything
          for you.
        </p>

        <h2>Estimates, not advice</h2>
        <p>
          Everything we show (grade odds, prices, fees, expected value) is an estimate and can be wrong. It&apos;s not financial,
          investment, or professional advice. You decide what to do with your cards, and you&apos;re responsible for that
          decision. See the <Link href="/disclaimer">disclaimer</Link>.
        </p>

        <h2>Not affiliated</h2>
        <p>
          We&apos;re independent. We&apos;re not affiliated with, endorsed by, or sponsored by PSA, CGC, Nintendo, The Pokémon
          Company, Creatures, or Game Freak. Their names are used only to describe the services and cards our math refers to.
          Card names and images belong to their owners.
        </p>

        <h2>Using the service</h2>
        <ul>
          <li>Don&apos;t abuse it: no scraping at volume, no attempts to break or overload it, no automated waitlist signups.</li>
          <li>Don&apos;t post false outcomes to Receipts. Reported grades may be checked against cert numbers and removed.</li>
          <li>Free-tier limits (like verdicts per day) may change.</li>
        </ul>

        <h2>What you post</h2>
        <p>
          If you log a prediction publicly, you let us display it on Receipts and in aggregate stats indefinitely. It contains
          card and verdict data, not your photo or identity. Ask us and we&apos;ll remove it.
        </p>

        <h2>Paid plans</h2>
        <p>
          Paid plans aren&apos;t available yet. When they are, their pricing and refund terms will be shown before you pay
          anything and will be added here.
        </p>

        <h2>No warranty</h2>
        <p>
          The service is provided &ldquo;as is.&rdquo; We work to keep fees and prices accurate but don&apos;t guarantee that
          any number is correct or current. To the extent the law allows, we&apos;re not liable for losses from decisions made
          using the service, including grading fees, shipping costs, or the difference between a predicted and actual grade
          or price. Where liability can&apos;t be excluded, it&apos;s limited to what you paid us in the past 12 months (for
          most people, $0).
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. If a change matters, we&apos;ll update the date above. Using the service after a change
          means you accept the new terms.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:hello@sleeveorslab.com">hello@sleeveorslab.com</a>
        </p>
      </Prose>
    </PageShell>
  );
}
