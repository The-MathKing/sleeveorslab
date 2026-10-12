import type { ReactNode } from "react";

// Root layout already renders SiteHeader (nav) + SiteFooter (disclaimer); this just sets the app column.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5 sm:pt-8">{children}</div>;
}
