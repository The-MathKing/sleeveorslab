import { NextResponse } from "next/server";
import type { Grade } from "@/lib/types";
import { recordOutcome } from "@/lib/db";
import { requireAdmin } from "../../../_lib/admin";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../../_lib/http";
import { LIMITS, rateLimit } from "../../../_lib/rateLimit";
import { outcomeSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, LIMITS.outcomePost);
  if (limited) return limited;

  const denied = requireAdmin(req);
  if (denied) return denied;

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
