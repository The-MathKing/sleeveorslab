import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePrediction, deleteWaitlist } from "@/lib/db";
import { requireAdmin } from "../../_lib/admin";
import { jsonError, readJsonBody, serverError, zodMessage } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Privacy deletion requests (see /privacy). Exactly one of email / predictionId.
const deleteSchema = z.union([
  z.object({ email: z.email().max(254) }).strict(),
  z.object({ predictionId: z.string().regex(/^(?:r-)?\d{1,9}$/i) }).strict(),
]);

export async function POST(req: Request) {
  const limited = rateLimit(req, LIMITS.outcomePost);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = deleteSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  try {
    const deleted =
      "email" in parsed.data ? await deleteWaitlist(parsed.data.email) : await deletePrediction(parsed.data.predictionId);
    return NextResponse.json({ deleted });
  } catch (err) {
    return serverError(err, "Could not delete");
  }
}
