import { NextResponse } from "next/server";
import { z } from "zod";
import { listWaitlist } from "@/lib/db";
import { requireAdmin } from "../../_lib/admin";
import { csvCell } from "../../_lib/csv";
import { jsonError, serverError, zodMessage } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const query = z.object({ format: z.enum(["json", "csv"]).default("json") });

/**
 * Waitlist export for the people who opted in to marketing email.
 * ?format=csv → text/csv download (email, created_at, source); default → JSON counts only.
 */
export async function GET(req: Request) {
  const limited = rateLimit(req, LIMITS.admin);
  if (limited) return limited;
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = query.safeParse({ format: new URL(req.url).searchParams.get("format") ?? undefined });
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));
  try {
    if (parsed.data.format === "json") {
      const [all, consenting] = await Promise.all([listWaitlist(), listWaitlist({ consentOnly: true })]);
      return NextResponse.json(
        { total: all.length, consenting: consenting.length },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const rows = await listWaitlist({ consentOnly: true });
    const lines = ["email,created_at,source", ...rows.map((r) => [r.email, r.createdAt, r.source ?? ""].map(csvCell).join(","))];
    const day = new Date().toISOString().slice(0, 10);
    return new Response(lines.join("\r\n") + "\r\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitlist-marketing-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return serverError(err, "Could not export waitlist");
  }
}
