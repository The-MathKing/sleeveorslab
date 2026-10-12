import { NextResponse } from "next/server";
import { z } from "zod";
import { getStats } from "@/lib/db";
import { requireAdmin } from "../../_lib/admin";
import { jsonError, serverError, zodMessage } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const query = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

export async function GET(req: Request) {
  const limited = rateLimit(req, LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = query.safeParse({ days: new URL(req.url).searchParams.get("days") ?? undefined });
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  try {
    const stats = await getStats({ days: parsed.data.days });
    return NextResponse.json({ stats }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err, "Could not load stats");
  }
}
