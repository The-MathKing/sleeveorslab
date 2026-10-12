import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Same name on several Disclosures = only one open at a time (native exclusive accordion). */
  name?: string;
  className?: string;
}

/** Native <details>, styled. Works without JS. */
export function Disclosure({ summary, children, defaultOpen, name, className }: DisclosureProps) {
  return (
    <details
      open={defaultOpen}
      name={name}
      className={cn("group/disc border-b border-line last:border-b-0", className)}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left font-semibold text-ink hover:text-ink-2 [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-3 transition-transform duration-200 group-open/disc:rotate-180"
        />
      </summary>
      <div className="pb-5 pr-2 text-[0.95rem] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

export interface AccordionProps {
  items: Array<{ id: string; summary: ReactNode; content: ReactNode }>;
  /** Only one item open at a time. */
  exclusive?: boolean;
  className?: string;
}

export function Accordion({ items, exclusive = false, className }: AccordionProps) {
  const name = exclusive ? `acc-${items.map((i) => i.id).join("-").slice(0, 40)}` : undefined;
  return (
    <div className={cn("rounded-card border border-line bg-card px-4 sm:px-5", className)}>
      {items.map((it) => (
        <Disclosure key={it.id} summary={it.summary} name={name}>
          {it.content}
        </Disclosure>
      ))}
    </div>
  );
}
