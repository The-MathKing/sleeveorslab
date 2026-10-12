import { NextResponse } from "next/server";
import { storageKind, waitlistCount } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ops check: which storage is live and whether it answers. Never returns secrets.
export async function GET() {
  const storage = storageKind();
  let db: "ok" | "error" = "ok";
  let detail: string | undefined;
  const started = Date.now();
  try {
    await waitlistCount();
  } catch (err) {
    db = "error";
    detail = err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/gi, "[url]").slice(0, 200) : "unknown";
  }
  const body = {
    ok: db === "ok" && storage === "postgres",
    storage,
    db,
    dbLatencyMs: Date.now() - started,
    adminConfigured: Boolean(process.env.ADMIN_TOKEN),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    priceSource: process.env.PRICECHARTING_API_KEY ? "pricecharting" : "tcgplayer-via-pokemontcg",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    // Names only (never values) of config-related variables, to debug integration prefixes.
    configVarNames: Object.keys(process.env)
      .filter((k) => /DATABASE|POSTGRES|^PG|NEON|ADMIN|STRIPE|SITE_URL|POKEMONTCG|PRICECHARTING/i.test(k))
      .sort(),
    ...(detail ? { detail } : {}),
  };
  return NextResponse.json(body, { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
