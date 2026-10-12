import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, Check, Crosshair, Layers, Receipt, ScanLine } from "lucide-react";
import { Accordion, Badge, Button, Container, Eyebrow, Money, Stat } from "@/components/ui";
import { CardArt } from "@/components/brand/CardArt";
import { CenteringExplainer } from "@/components/brand/CenteringExplainer";
import { ExampleVerdictCard } from "@/components/brand/ExampleVerdictCard";
import { LiveCenteringDemo } from "@/components/brand/LiveCenteringDemo";
import { VerdictStamp } from "@/components/brand/VerdictStamp";
import { WaitlistForm } from "@/components/brand/WaitlistForm";
import { EXAMPLE } from "@/components/brand/exampleData";

export const metadata: Metadata = {
  title: { absolute: "Sleeve or Slab · The app that tells you when not to grade" },
  alternates: { canonical: "/" },
};

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8 max-w-2xl sm:mb-10">
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h2 className="font-display text-[clamp(2.1rem,7vw,3.4rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-ink text-balance">
        {title}
      </h2>
      {children && <p className="mt-4 text-lg text-ink-2 text-pretty">{children}</p>}
    </div>
  );
}

const steps = [
  {
    n: "01",
    icon: Camera,
    title: "Snap",
    body: "Photograph the front (and back, if you're thorough). Find the card by name and number so we can pull the raw price.",
  },
  {
    n: "02",
    icon: Crosshair,
    title: "Center check",
    body: "We measure left/right and top/bottom borders on your phone and tell you which grades your centering still allows.",
  },
  {
    n: "03",
    icon: Receipt,
    title: "Verdict, with EV",
    body: "Grade odds × graded prices, minus fees, shipping and selling costs, versus just selling it raw. Sleeve, slab, or borderline.",
  },
];

const faqs = [
  {
    id: "grade",
    summary: "Do you predict my card's grade?",
    content: (
      <p>
        No. We estimate a range of likely grades from centering, your own condition check, and how cards from that era
        tend to grade. You get probabilities, never a promised number. Anyone promising you a PSA 10 from a phone photo is
        selling something.
      </p>
    ),
  },
  {
    id: "affiliated",
    summary: "Are you affiliated with PSA or CGC?",
    content: (
      <p>
        No. We&apos;re not affiliated with PSA, CGC, Nintendo, or The Pokémon Company. When we say &ldquo;PSA-style grade
        estimate&rdquo; we mean our estimate on their scale, not theirs.
      </p>
    ),
  },
  {
    id: "photos",
    summary: "Where do my photos go?",
    content: (
      <p>
        Nowhere. Centering runs in your browser. If you choose to log a verdict publicly on Receipts, we store the card and
        the verdict, never the photo. Details on the <Link className="font-semibold text-ink underline decoration-slab decoration-2 underline-offset-2" href="/privacy">privacy page</Link>.
      </p>
    ),
  },
  {
    id: "prices",
    summary: "Where do the prices come from?",
    content: (
      <p>
        Raw prices come from public market data. Graded prices come from sales data when we have it. When we don&apos;t, we
        estimate, and the number carries an &ldquo;estimate&rdquo; label so you know which is which.
      </p>
    ),
  },
  {
    id: "wrong",
    summary: "What if you're wrong?",
    content: (
      <p>
        We will be, sometimes. That&apos;s why Receipts exists: verdicts get logged with a timestamp before the grade comes back,
        and the results stay up whether they flatter us or not.
      </p>
    ),
  },
  {
    id: "cost",
    summary: "Is it free?",
    content: (
      <p>
        Card lookup, centering, and three verdicts a day are free. A Pro plan for heavy submitters is coming;{" "}
        <Link className="font-semibold text-ink underline decoration-slab decoration-2 underline-offset-2" href="/pricing">see pricing</Link>.
      </p>
    ),
  },
];

const receiptsRows = [
  { id: "R-0107", verdict: "SLEEVE" as const, call: "Most likely 9 (52%)", result: "PSA 9", hit: true },
  { id: "R-0104", verdict: "SLAB" as const, call: "Most likely 10 (46%)", result: "PSA 10", hit: true },
  { id: "R-0098", verdict: "BORDERLINE" as const, call: "Most likely 9 (44%)", result: "PSA 8", hit: false },
  { id: "R-0093", verdict: "SLEEVE" as const, call: "Most likely 8 (39%)", result: "pending", hit: null },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden border-b border-line">
        <Container className="grid items-center gap-10 pb-16 pt-10 sm:pt-16 md:grid-cols-[1.15fr_0.85fr] md:gap-6 md:pb-24">
          <div className="rise-in min-w-0">
            <Badge tone="sleeve" size="md" className="mb-5">
              For Pokémon collectors · PSA &amp; CGC
            </Badge>
            <h1 className="font-display text-[clamp(2.9rem,11.5vw,5.6rem)] font-extrabold uppercase leading-[0.88] tracking-tight text-ink text-balance">
              This <span className="font-mono text-[0.8em] font-bold tracking-tighter">$150</span> card is a bad grade.
              <span className="mt-2 block text-ink-3">Here&apos;s the math.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2 text-pretty">
              Sleeve or Slab checks centering on your phone, adds up the fees, and tells you whether grading actually
              beats selling raw. Usually it doesn&apos;t. <strong className="font-semibold text-ink">Save the $60.</strong>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/scan" size="lg" iconLeft={<ScanLine className="size-5" aria-hidden="true" />}>
                Check a card
              </Button>
              <Button href="/binder" size="lg" variant="outline" iconLeft={<Layers className="size-5" aria-hidden="true" />}>
                Audit a whole binder
              </Button>
            </div>
            <ul className="mt-8 flex flex-col gap-2 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {["Photos never leave your phone", "No account needed", "Every number shows its work"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-good" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[22rem] md:max-w-none">
            <div className="relative mx-auto w-[min(17rem,68vw)] rotate-[3deg] [container-type:inline-size]">
              <CardArt leftShare={0.62} name="Example Holo ex" number="199/197" />
              {/* price tag */}
              <div className="absolute -left-5 top-8 -rotate-[8deg] rounded-md border border-line-strong bg-receipt px-2.5 py-1.5 shadow-card">
                <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-3">Raw NM</p>
                <p className="font-mono text-lg font-semibold leading-none text-ink">$150.00</p>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[14%] flex justify-center">
              <VerdictStamp verdict="SLEEVE" size="lg" animate delayMs={450} caption="EV −$61.03 vs raw" backing />
            </div>
            <p className="mt-4 text-center font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-3">
              Example card · illustrative numbers
            </p>
          </div>
        </Container>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section aria-labelledby="how" className="py-16 sm:py-24">
        <Container>
          <SectionHeading eyebrow="How it works" title={<span id="how">Three steps. About a minute.</span>} />
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className="rise-in relative flex flex-col gap-3 rounded-card border border-line bg-card p-5 shadow-card"
                style={{ "--rise-delay": `${i * 90}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-paper-2 text-ink ring-1 ring-line">
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink-3">{s.n}</span>
                </div>
                <h3 className="font-display text-2xl font-bold uppercase text-ink">{s.title}</h3>
                <p className="text-[0.95rem] text-ink-2">{s.body}</p>
                {i < steps.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute -right-3.5 top-1/2 z-10 hidden size-6 -translate-y-1/2 rounded-full bg-paper p-1 text-ink-3 ring-1 ring-line md:block"
                  />
                )}
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------- EXAMPLE VERDICT ---------- */}
      <section aria-labelledby="receipt-example" className="border-y border-line bg-paper-2/60 py-16 sm:py-24">
        <Container className="grid items-start gap-12 md:grid-cols-2">
          <div>
            <SectionHeading eyebrow="What you get" title={<span id="receipt-example">Every verdict comes with a receipt.</span>}>
              Not a vibe, not a &ldquo;looks gem to me.&rdquo; The odds, the prices, every fee, and the one number that matters:
              how much better or worse off you are than if you&apos;d just sold it raw.
            </SectionHeading>
            <div className="grid grid-cols-2 gap-6 border-t border-line pt-6">
              <Stat label="Example card, raw" value={<Money amount={EXAMPLE.raw} />} />
              <Stat label="Grade it instead" value={<Money amount={EXAMPLE.expectedGain} signed />} estimate />
              <Stat label="Chance it loses money" value="82%" tone="bad" />
              <Stat label="Grade needed to win" value={`${EXAMPLE.grader} 10`} tone="slab" />
            </div>
            <p className="mt-6 text-sm text-ink-3">
              Example only: a made-up card with round numbers so you can check the arithmetic yourself.
            </p>
          </div>
          <div className="mx-auto w-full max-w-md md:pt-6">
            <ExampleVerdictCard />
          </div>
        </Container>
      </section>

      {/* ---------- WHY SLEEVE ---------- */}
      <section aria-labelledby="why" className="py-16 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Why we usually say sleeve" title={<span id="why">Most cards should stay sleeved.</span>}>
            Grading isn&apos;t a lottery ticket that costs $60. It&apos;s a $60 ticket that also costs shipping, insurance, a few
            months, and a cut of the sale. The graded copy has to clear all of that before you&apos;ve made a cent.
          </SectionHeading>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-card border border-line bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold uppercase text-ink">The fee is per card, not per win</h3>
              <p className="mt-2 text-[0.95rem] text-ink-2">
                You pay the same to grade the card that comes back a 10 as the one that comes back an 8. Your 8s and 9s have to
                carry the cost of trying.
              </p>
            </div>
            <div className="rounded-card border border-line bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold uppercase text-ink">Gem rates are lower than they feel</h3>
              <p className="mt-2 text-[0.95rem] text-ink-2">
                Pack fresh isn&apos;t gem mint. Print lines, whitening, and centering knock most cards out of 10 territory. We show
                the gem-rate prior we use for your card and you can change it.
              </p>
            </div>
            <div className="rounded-card border border-line bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold uppercase text-ink">A 9 is often worth about raw</h3>
              <p className="mt-2 text-[0.95rem] text-ink-2">
                For a lot of modern cards the 9 sells near the raw price. Pay $80 all-in to turn a $150 card into a $165 card
                and you&apos;ve lost money with a nice plastic case.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border border-slab/50 bg-slab-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <VerdictStamp verdict="SLAB" size="xs" rotate={-6} />
              <p className="max-w-xl text-[0.95rem] text-ink-2">
                <strong className="text-ink">We do say slab.</strong> When centering is clean, the gem rate is decent and the
                10 is worth multiples of raw, the math says grade it, and we&apos;ll tell you which tier.
              </p>
            </div>
            <Button href="/how-it-works" variant="ghost" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
              Read the method
            </Button>
          </div>
        </Container>
      </section>

      {/* ---------- CENTERING ---------- */}
      <section aria-labelledby="centering" className="border-y border-line bg-paper-2/60 py-16 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Off-Center" title={<span id="centering">55/45 is the line you can measure at home.</span>}>
            Centering is the one grading factor a phone camera can measure well. Before you pay anyone to look at your card,
            check whether its borders already rule out a 10.
          </SectionHeading>
          <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
            <div className="rounded-card border border-line bg-card p-5 shadow-card sm:p-7">
              <CenteringExplainer />
            </div>
            {/* Bounded slot: the live tool from src/components/scan gets wired in here by the lead. */}
            <LiveCenteringDemo />
          </div>
        </Container>
      </section>

      {/* ---------- RECEIPTS TEASER ---------- */}
      <section aria-labelledby="receipts" className="py-16 sm:py-24">
        <Container className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Receipts" title={<span id="receipts">We log our calls before the grades come back.</span>}>
              When someone submits a card we gave a verdict on, the prediction goes into a public log with a timestamp.
              When the grade comes back, it goes next to it. Hits and misses both stay up.
            </SectionHeading>
            <Button href="/receipts" variant="outline" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
              See the log
            </Button>
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-receipt font-mono shadow-card">
            <div className="flex items-center justify-between border-b border-dashed border-line-strong px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
              <span>Prediction log</span>
              <Badge tone="borderline">Example rows</Badge>
            </div>
            <ul className="divide-y divide-dashed divide-line">
              {receiptsRows.map((r) => (
                <li key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
                  <span className="text-ink-3">{r.id}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{r.call}</span>
                    <span
                      className={
                        r.verdict === "SLAB" ? "text-xs text-slab-deep" : r.verdict === "SLEEVE" ? "text-xs text-sleeve-deep" : "text-xs text-borderline"
                      }
                    >
                      {r.verdict === "SLAB" ? "SLAB IT." : r.verdict === "SLEEVE" ? "SLEEVE IT." : "BORDERLINE"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-ink">{r.result}</span>
                    <span className={r.hit === null ? "text-xs text-ink-3" : r.hit ? "text-xs text-good" : "text-xs text-bad"}>
                      {r.hit === null ? "waiting" : r.hit ? "called it" : "missed"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ---------- WAITLIST ---------- */}
      <section aria-labelledby="waitlist" className="pb-16 sm:pb-24">
        <Container size="lg">
          <div className="relative overflow-hidden rounded-[calc(var(--radius)+8px)] bg-ink p-6 text-on-ink sm:p-10">
            <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slab">Pro is coming</p>
                <h2 id="waitlist" className="mt-3 font-display text-[clamp(2rem,7vw,3.2rem)] font-extrabold uppercase leading-[0.95]">
                  Grading a stack? Get early access.
                </h2>
                <p className="mt-3 text-on-ink/75">
                  Unlimited verdicts, binder audits for whole submissions, and tier picking across graders. One email when it
                  opens. No drip campaign.
                </p>
              </div>
              <div className="rounded-xl bg-paper p-4 text-ink sm:p-5">
                <WaitlistForm source="landing" />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- FAQ ---------- */}
      <section aria-labelledby="faq" className="pb-8">
        <Container size="md">
          <SectionHeading eyebrow="FAQ" title={<span id="faq">Fair questions.</span>} />
          <Accordion items={faqs} />
        </Container>
      </section>
    </>
  );
}
