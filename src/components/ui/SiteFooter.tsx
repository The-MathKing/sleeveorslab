import Link from "next/link";
import { Logomark } from "@/components/brand/Logomark";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "./Container";

export const FOOTER_DISCLAIMER =
  "Estimates, not financial advice. Not affiliated with PSA, CGC, Nintendo, or The Pokémon Company.";

const groups = [
  {
    title: "Tools",
    links: [
      { href: "/scan", label: "Check a card" },
      { href: "/binder", label: "Binder Audit" },
      { href: "/receipts", label: "Receipts" },
      { href: "/collection", label: "Collection" },
    ],
  },
  {
    title: "The math",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/fees", label: "Grading fees" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Fine print",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
];

/** Site footer with the required disclaimer. Rendered on every page by the root layout. */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-2/60">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.3fr_2fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Logomark size={44} title="" />
            <Wordmark size="sm" />
          </div>
          <p className="max-w-xs text-sm text-ink-2">
            The app that tells you when not to grade. Most cards should stay sleeved.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <h2 className="mb-3 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-3">{g.title}</h2>
              <ul className="flex flex-col gap-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-ink-2 hover:text-ink hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-2 py-5 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono">{FOOTER_DISCLAIMER}</p>
          <p className="font-mono">© {new Date().getFullYear()} Sleeve or Slab</p>
        </Container>
      </div>
    </footer>
  );
}
