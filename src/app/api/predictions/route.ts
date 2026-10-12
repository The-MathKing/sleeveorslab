import { NextResponse } from "next/server";
import { z } from "zod";
import type { GradeDistribution } from "@/lib/types";
import { addPrediction, listPredictions } from "@/lib/db";
import { jsonError, readJsonBody, serverError, zodMessage } from "../_lib/http";
import { LIMITS, rateLimit } from "../_lib/rateLimit";
import { predictionCreateSchema } from "../_lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

export async function GET(req: Request) {
  const limited = rateLimit(req, LIMITS.read);
  if (limited) return limited;

  const parsed = listQuery.safeParse({ limit: new URL(req.url).searchParams.get("limit") ?? undefined });
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  try {
    const predictions = await listPredictions({ publicOnly: true, limit: parsed.data.limit });
    return NextResponse.json({ predictions }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  const limited = rateLimit(req, LIMITS.predictionsPost);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = predictionCreateSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  try {
    const d = parsed.data;
    const prediction = await addPrediction({
      ...d,
      distribution: d.distribution as unknown as GradeDistribution,
    });
    return NextResponse.json({ prediction }, { status: 201 });
  } catch (err) {
    return serverError(err, "Could not save prediction");
  }
}
