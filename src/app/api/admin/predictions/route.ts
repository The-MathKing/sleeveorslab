import { NextResponse } from "next/server";
import { z } from "zod";
import { listPredictions } from "@/lib/db";
import { requireAdmin } from "../../_lib/admin";
import { jsonError, serverError, zodMessage } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const query = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(200) });

/** Every prediction, public and private (GET /api/predictions lists public only). */
export async function GET(req: Request) {
  const limited = rateLimit(req, LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = query.safeParse({ limit: new URL(req.url).searchParams.get("limit") ?? undefined });
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  try {
    const predictions = await listPredictions({ publicOnly: false, limit: parsed.data.limit });
    return NextResponse.json({ predictions }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
