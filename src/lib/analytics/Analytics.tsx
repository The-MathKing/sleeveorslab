"use client";
// Counts a page_view on each route change. Cookieless and first-party: see src/lib/analytics/client.ts.
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "./client";

export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    trackPageView(pathname);
  }, [pathname]);
  return null;
}
