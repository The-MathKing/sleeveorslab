import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, ProbabilityBar } from "@/components/ui";
import { Callout, PageShell, Prose } from "@/components/brand/Prose";
import { VerdictStamp } from "@/components/brand/VerdictStamp";
import { EXAMPLE } from "@/components/brand/exampleData";

export const metadata: Metadata = pageMetadata("/how-it-works", "How it works", "The method behind every verdict: centering measurement, grade probabilities, fees, and expected value versus selling raw. Plus what we can't do.");

export default function HowItWorksPage() {
  return (
    <PageShell
      eyebrow="The method"
      title="Do the math before you slab."
      lede="Every verdict is the same calculation, shown in full. Here's what goes in, what comes out, and where it can be wrong."
    >
      <Prose>
        <h2>The question we answer</h2>
        <p>
          Not &ldquo;what will this card grade?&rdquo; but: <strong>are you likely to end up with more money by grading this card
          than by selling it raw?</strong> That&apos;s a question about fees and odds, and it&apos;s one a phone can help with.
        </p>

        <h2>1. Centering</h2>
        <p>
          We find the card&apos;s outer edge and the inner frame of the artwork, then measure the four borders. Centering is
          reported the way graders talk about it: the bigger side&apos;s share, like <code>55/45</code> left/right and{" "}
          <code>60/40</code> top/bottom. You can drag the guides if the auto-detect is off, and a manual adjustment always wins.
        </p>
        <p>
          We compare that to each grader&apos;s published centering tolerances to find the <strong>highest grade your centering
          still allows</strong>. A card that measures 63/37 on the front won&apos;t get a 10 no matter how clean the corners
          are, so the 10 comes out of the odds before anything else happens.
        </p>
        <p>
          Measurement runs in your browser. The photo never leaves your device.
        </p>

        <h2>2. Grade odds</h2>
        <p>
          We start from a <strong>gem-rate prior</strong>: roughly how often cards of that era, finish and rarity come back a 10
          when they look clean. Then we adjust for your centering caps and your own condition check (corners, edges, surface,
          on a 1–5 scale). The result is a probability for each grade, shown as a chart like this:
        </p>
      </Prose>

      <div className="my-6 max-w-2xl rounded-card border border-line bg-card p-5 shadow-card">
        <ProbabilityBar distribution={EXAMPLE.distribution} grader="PSA" breakEvenGrade={EXAMPLE.breakEvenGrade} caption="Example: estimated grade odds" />
      </div>

      <Prose>
        <p>
          The prior is labelled with its basis, and you can override it. If you know your set gems at 40% for clean pulls, put
          in 40% and watch the verdict move.
        </p>

        <h2>3. Prices</h2>
        <p>
          Raw near-mint price comes from public market data. Graded prices come from recent sales when we have them. When we
          don&apos;t, we estimate graded prices with multipliers on raw, and those numbers are always labelled{" "}
          <strong>estimate</strong>.
        </p>

        <h2>4. Costs</h2>
        <ul>
          <li>The grading fee for the tier that matches the card&apos;s likely graded value (see <Link href="/fees">the fee table</Link>).</li>
          <li>Shipping and insurance per card, both ways.</li>
          <li>Selling fees on the graded sale (default 13%) and, for a fair comparison, on the raw sale too.</li>
          <li>Optionally, price drift over the turnaround time. Markets move while your card sits in a queue.</li>
        </ul>

        <h2>5. The verdict</h2>
        <p>
          Expected value of grading = Σ P(grade) × net graded sale − costs. Compare to the net raw sale. The difference is the
          headline number, along with the probability that grading loses money and the lowest grade that breaks even.
        </p>
      </Prose>

      <div className="my-8 grid max-w-2xl gap-4 sm:grid-cols-3">
        {(
          [
            ["SLEEVE", "Expected gain is negative, or the upside depends on a long-shot 10."],
            ["BORDERLINE", "Roughly break-even, or the answer swings on an assumption you should check."],
            ["SLAB", "Positive expected gain with a reasonable chance of not losing money."],
          ] as const
        ).map(([v, text]) => (
          <div key={v} className="flex flex-col items-center gap-3 rounded-card border border-line bg-card p-4 text-center shadow-card">
            <VerdictStamp verdict={v} size="sm" />
            <p className="text-sm text-ink-2">{text}</p>
          </div>
        ))}
      </div>

      <Prose>
        <h2>What we can&apos;t do</h2>
        <ul>
          <li>
            <strong>See surface.</strong> Scratches, print lines and dents under holo foil are what usually separate a 9 from a
            10, and a phone photo doesn&apos;t reliably catch them. That&apos;s why your condition check matters, and why our odds
            are a range.
          </li>
          <li>
            <strong>Know your card&apos;s history.</strong> We see one photo. We don&apos;t know if it spent a year in a top-loader
            or a shoebox.
          </li>
          <li>
            <strong>Predict the market.</strong> Graded prices move, sometimes a lot, between submission and return.
          </li>
          <li>
            <strong>Read a grader&apos;s mind.</strong> Grading is done by people. The same card can come back differently on
            different days.
          </li>
        </ul>

        <Callout title="Why we don't sell &ldquo;AI grading&rdquo;" tone="borderline">
          <p>
            Apps that read a photo and print &ldquo;PSA 10&rdquo; are guessing with confidence they haven&apos;t earned. No
            phone photo can see the surface the way a grader under a lamp does, and nobody has published proof that those
            guesses beat a coin flip on the 9-vs-10 call that actually matters.
          </p>
          <p>
            We&apos;d rather tell you exactly what we measured, what we assumed, and how wide the uncertainty is. Then we log our
            calls on <Link href="/receipts">Receipts</Link> so you can check how we&apos;re doing.
          </p>
        </Callout>

        <h2>The honesty rules</h2>
        <ol>
          <li>We say &ldquo;PSA-style grade estimate,&rdquo; never &ldquo;PSA grade.&rdquo; We aren&apos;t affiliated with any grader.</li>
          <li>Every verdict shows its assumptions and a probability range, never a promised grade.</li>
          <li>Every estimated number is labelled &ldquo;estimate.&rdquo;</li>
          <li>The fee table carries a last-verified date.</li>
          <li>We publish our misses.</li>
        </ol>
      </Prose>

      <div className="mt-10">
        <Button href="/scan" size="lg" iconRight={<ArrowRight className="size-5" aria-hidden="true" />}>
          Run the math on a card
        </Button>
      </div>
    </PageShell>
  );
}
