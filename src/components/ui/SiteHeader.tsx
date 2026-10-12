"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, ScanLine, X } from "lucide-react";
import { Logo } from "@/components/brand/Wordmark";
import { Button } from "./Button";
import { cn } from "./cn";

export const NAV_LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/binder", label: "Binder" },
  { href: "/receipts", label: "Receipts" },
  { href: "/collection", label: "Collection" },
  { href: "/fees", label: "Fees" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sticky top bar: logo, primary nav, "Check a card" CTA, and a mobile sheet menu. */
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Close the menu on navigation and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/75">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-ink"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Sleeve or Slab home" className="shrink-0 rounded-md">
          <Logo size="sm" compactOnMobile />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "text-ink" : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    {l.label}
                    {active && (
                      <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-[3px] rounded-full bg-slab" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button href="/scan" size="sm" iconLeft={<ScanLine className="size-4" aria-hidden="true" />} className="max-[379px]:px-2.5">
            Check a card
          </Button>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-ink/5 md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav
        id={menuId}
        aria-label="Mobile"
        hidden={!open}
        className="border-t border-line bg-paper md:hidden"
      >
        <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {NAV_LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-2 py-3 font-display text-2xl font-bold uppercase tracking-wide",
                    active ? "text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {l.label}
                  {active && <span aria-hidden="true" className="size-2 rounded-full bg-slab" />}
                </Link>
              </li>
            );
          })}
          <li className="mt-1 border-t border-line pt-2">
            <Link href="/how-it-works" className="block rounded-lg px-2 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink">
              How it works
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="block rounded-lg px-2 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink">
              Pricing
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
