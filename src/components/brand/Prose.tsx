import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Card";

/**
 * Shared shell for long-form marketing and legal pages: eyebrow, display title,
 * lede, optional "last updated", then readable body copy.
 */
export function PageShell({
  eyebrow,
  title,
  lede,
  updated,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  updated?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Container size={wide ? "lg" : "md"} className="pt-10 sm:pt-16">
      <header className="mb-10 border-b border-line pb-8">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-[clamp(2.4rem,9vw,4rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-ink text-balance">
          {title}
        </h1>
        {lede && <p className="mt-4 max-w-2xl text-lg text-ink-2 text-pretty">{lede}</p>}
        {updated && <p className="mt-4 font-mono text-xs text-ink-3">Last updated {updated}</p>}
      </header>
      {children}
    </Container>
  );
}

/** Typography for running text, without a typography plugin. */
export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        "max-w-2xl text-[1.02rem] leading-relaxed text-ink-2 " +
        "[&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:leading-tight [&_h2]:text-ink " +
        "[&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink " +
        "[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1.5 " +
        "[&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:decoration-slab [&_a]:decoration-2 [&_a]:underline-offset-2 " +
        "[&_strong]:font-semibold [&_strong]:text-ink [&_code]:rounded [&_code]:bg-paper-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] " +
        className
      }
    >
      {children}
    </div>
  );
}

/** A callout box inside Prose. */
export function Callout({ title, children, tone = "sleeve" }: { title: ReactNode; children: ReactNode; tone?: "sleeve" | "slab" | "borderline" }) {
  const t = {
    sleeve: "border-sleeve/40 bg-sleeve-soft",
    slab: "border-slab/60 bg-slab-soft",
    borderline: "border-borderline/40 bg-borderline-soft",
  }[tone];
  return (
    <aside className={`my-6 rounded-xl border p-4 ${t}`}>
      <p className="font-semibold text-ink">{title}</p>
      <div className="mt-1 text-sm text-ink-2 [&_p]:my-2">{children}</div>
    </aside>
  );
}
