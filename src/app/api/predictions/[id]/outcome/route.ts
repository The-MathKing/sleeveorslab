import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import type { Grade } from "@/lib/types";
import { recordOutcome } from "@/lib/db";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../../_lib/http";
import { LIMITS, rateLimit } from "../../../_lib/rateLimit";
import { outcomeSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tokenMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, LIMITS.outcomePost);
  if (limited) return limited;

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return jsonError(403, "Outcome reporting is disabled (ADMIN_TOKEN not configured)");
  const given = req.headers.get("x-admin-token");
  if (!given || !tokenMatches(given, expected)) return jsonError(401, "Unauthorized");

  const { id } = await params;
  if (!/^(?:r-)?\d{1,9}$/i.test(id)) return jsonError(400, "Invalid prediction id");

  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = outcomeSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  try {
    const prediction = await recordOutcome(id, {
      grade: parsed.data.grade as Grade,
      certNumber: parsed.data.certNumber,
      reportedAt: new Date().toISOString(),
    });
    if (!prediction) return jsonError(404, "Prediction not found");
    return NextResponse.json({ prediction });
  } catch (err) {
    return serverError(err, "Could not record outcome");
  }
}
