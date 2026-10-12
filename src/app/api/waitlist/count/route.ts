import { NextResponse } from "next/server";
import { waitlistCount } from "@/lib/db";
import { serverError } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = rateLimit(req, LIMITS.read);
  if (limited) return limited;
  try {
    return NextResponse.json({ count: await waitlistCount() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
