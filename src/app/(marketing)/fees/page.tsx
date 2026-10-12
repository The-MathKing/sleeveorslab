import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import * as grading from "@/lib/grading";
import type { GraderId, GradingTier } from "@/lib/types";
import { Badge, Button, EmptyState, Money } from "@/components/ui";
import { PageShell, Prose } from "@/components/brand/Prose";

export const metadata: Metadata = {
  title: "Grading fees",
  description: "PSA and CGC grading tiers, fees, declared-value caps and turnaround, with the date we last checked them.",
  alternates: { canonical: "/fees" },
};

// The engines module may still be `declare` stubs during development; read it defensively.
function loadTiers(): { tiers: GradingTier[]; verified: string | null } {
  try {
    const tiers = typeof grading.getTiers === "function" ? grading.getTiers() : [];
    const verified = typeof grading.FEES_LAST_VERIFIED === "string" ? grading.FEES_LAST_VERIFIED : null;
    return { tiers: Array.isArray(tiers) ? tiers : [], verified };
  } catch {
    return { tiers: [], verified: null };
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function TierTable({ grader, tiers }: { grader: GraderId; tiers: GradingTier[] }) {
  return (
    <section aria-labelledby={`t-${grader}`} className="mb-12">
      <h2 id={`t-${grader}`} className="mb-4 font-display text-3xl font-bold uppercase text-ink">
        {grader}
      </h2>
      <div className="overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">{grader} grading tiers</caption>
          <thead className="border-b border-line bg-paper-2/70 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Tier</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Fee / card</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Max value</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Turnaround</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tiers.map((t) => (
              <tr key={t.id} className={t.available ? "" : "opacity-60"}>
                <th scope="row" className="px-4 py-3 align-top font-semibold text-ink">
                  <span className="flex flex-wrap items-center gap-2">
                    {t.name}
                    {!t.available && <Badge>Paused</Badge>}
                    {t.minCards ? <Badge tone="sleeve">min {t.minCards}</Badge> : null}
                  </span>
                  {t.notes && <span className="mt-0.5 block text-xs font-normal text-ink-3">{t.notes}</span>}
                </th>
                <td className="px-4 py-3 text-right align-top">
                  <Money amount={t.feeUsd} cents className="font-semibold text-ink" />
                </td>
                <td className="px-4 py-3 text-right align-top font-mono text-ink-2">
                  {t.maxDeclaredValueUsd ? <Money amount={t.maxDeclaredValueUsd} cents={false} /> : "—"}
                </td>
                <td className="px-4 py-3 text-right align-top font-mono text-ink-2">
                  {t.turnaroundBusinessDays[0]}–{t.turnaroundBusinessDays[1]} bus. days
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function FeesPage() {
  const { tiers, verified } = loadTiers();
  const graders: GraderId[] = ["PSA", "CGC"];

  return (
    <PageShell
      eyebrow="The fee table"
      title="What grading actually costs."
      lede="Every verdict uses these numbers. They live in one config file, and we put the date we last checked them right here. Graders change prices often; if you spot a stale one, tell us."
      wide
    >
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge tone={verified ? "good" : "borderline"} size="md">
          {verified ? `Last verified ${formatDate(verified)}` : "Verification date pending"}
        </Badge>
        <span className="text-sm text-ink-3">Prices in USD, per card, before shipping, insurance and tax.</span>
      </div>

      {tiers.length === 0 ? (
        <EmptyState
          title="Fee table loading soon"
          description="The fee config isn't wired up in this build yet. Check back shortly, or run a card and we'll show the tier we'd use."
          action={
            <Button href="/scan" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
              Check a card
            </Button>
          }
        />
      ) : (
        graders.map((g) => {
          const rows = tiers.filter((t) => t.grader === g);
          return rows.length ? <TierTable key={g} grader={g} tiers={rows} /> : null;
        })
      )}

      <Prose>
        <h2>What the fee table doesn&apos;t include</h2>
        <ul>
          <li>
            <strong>Shipping and insurance, both directions.</strong> Our default adds a per-card amount you can change on
            every verdict. On small submissions it&apos;s often the second-biggest cost.
          </li>
          <li>
            <strong>Upcharges.</strong> If a grader decides your card is worth more than the tier&apos;s declared-value cap,
            they bump it to a pricier tier. We pick the tier from the card&apos;s likely graded value, not its raw price, to
            avoid surprises.
          </li>
          <li>
            <strong>Selling costs.</strong> Marketplace and payment fees come out of the graded sale. We default to 13% and
            you can change it.
          </li>
          <li>
            <strong>Membership fees and minimums.</strong> Some tiers require a paid membership or a minimum card count.
            Where that applies, it&apos;s noted in the table.
          </li>
        </ul>
        <p>
          We&apos;re not affiliated with PSA or CGC. Always confirm the current price on the grader&apos;s own site before you
          submit.
        </p>
      </Prose>
    </PageShell>
  );
}
