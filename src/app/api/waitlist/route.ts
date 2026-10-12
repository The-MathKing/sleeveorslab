import { NextResponse } from "next/server";
import { addWaitlist, waitlistCount } from "@/lib/db";
import { jsonError, readJsonBody, serverError, zodMessage } from "../_lib/http";
import { LIMITS, rateLimit } from "../_lib/rateLimit";
import { waitlistSchema } from "../_lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = rateLimit(req, LIMITS.waitlistPost);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const parsed = waitlistSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  try {
    const { ok, duplicate } = await addWaitlist({
      email: parsed.data.email,
      source: parsed.data.source || undefined,
      consentMarketing: parsed.data.consentMarketing,
      createdAt: new Date().toISOString(),
    });
    const count = await waitlistCount();
    return NextResponse.json({ ok, duplicate, count }, { status: duplicate ? 200 : 201 });
  } catch (err) {
    return serverError(err, "Could not save signup");
  }
}
