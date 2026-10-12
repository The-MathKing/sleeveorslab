import type { MetadataRoute } from "next";
import { listPredictions } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// Rebuilt hourly so newly logged public receipts get indexed.
export const revalidate = 3600;

type Entry = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number };

// Public, indexable routes. Individual public receipts are appended from the database.
const ROUTES: Entry[] = [
  // Marketing
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/fees", changeFrequency: "weekly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 },
  // App
  { path: "/scan", changeFrequency: "monthly", priority: 0.9 },
  { path: "/binder", changeFrequency: "monthly", priority: 0.7 },
  { path: "/receipts", changeFrequency: "daily", priority: 0.7 },
  { path: "/collection", changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const pages: MetadataRoute.Sitemap = ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
  try {
    const receipts = await listPredictions({ publicOnly: true, limit: 1000 });
    for (const p of receipts) {
      pages.push({
        url: `${SITE_URL}/receipts/${p.id}`,
        lastModified: new Date(p.outcome?.reportedAt ?? p.createdAt),
        changeFrequency: p.outcome ? "yearly" : "weekly",
        priority: 0.4,
      });
    }
  } catch {
    // Storage unavailable at build time: the static routes are still a valid sitemap.
  }
  return pages;
}
