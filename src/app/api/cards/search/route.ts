import { NextResponse } from "next/server";
import { z } from "zod";
import { CardProviderError, searchCards } from "@/lib/cards";
import { jsonError, serverError, zodMessage } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: Request) {
  const limited = rateLimit(req, LIMITS.search);
  if (limited) return limited;

  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({ q: sp.get("q") ?? "", limit: sp.get("limit") ?? undefined });
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  try {
    const cards = await searchCards(parsed.data.q, { limit: parsed.data.limit });
    return NextResponse.json({ cards }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=600" } });
  } catch (err) {
    if (err instanceof CardProviderError) return jsonError(502, "Card search is temporarily unavailable");
    return serverError(err);
  }
}
