import { NextResponse } from "next/server";
import { getPrediction } from "@/lib/db";
import { jsonError, serverError } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, LIMITS.read);
  if (limited) return limited;

  const { id } = await params;
  if (!/^(?:r-)?\d{1,9}$/i.test(id)) return jsonError(400, "Invalid prediction id");
  try {
    const prediction = await getPrediction(id);
    // Ids are sequential, so non-public predictions are not retrievable by id.
    if (!prediction || !prediction.isPublic) return jsonError(404, "Prediction not found");
    return NextResponse.json({ prediction }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
