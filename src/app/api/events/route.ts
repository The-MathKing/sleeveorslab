// Anonymous, cookieless event counting (see /privacy). Stores the event name, a per-tab
// random visit id, a few enum props, and a server timestamp. Never the IP or user agent.
import { recordEvent } from "@/lib/db";
import { eventSchema } from "@/lib/analytics/schema";
import { jsonError, serverError, zodMessage } from "../_lib/http";
import { LIMITS, rateLimit } from "../_lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_EVENT_BYTES = 4 * 1024;
const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const limited = rateLimit(req, LIMITS.events);
  if (limited) return limited;

  // Belt and braces: the client already sends nothing under Do Not Track / GPC.
  if (req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1") return noContent();

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_EVENT_BYTES) return jsonError(413, "Request body too large");
  let text: string;
  try {
    text = await req.text();
  } catch {
    return jsonError(400, "Could not read request body");
  }
  if (new TextEncoder().encode(text).length > MAX_EVENT_BYTES) return jsonError(413, "Request body too large");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return jsonError(400, "Body must be valid JSON");
  }
  const parsed = eventSchema.safeParse(data);
  if (!parsed.success) return jsonError(400, zodMessage(parsed.error));

  try {
    const { name, visitId, props } = parsed.data;
    await recordEvent({ name, visitId, props: props ?? {}, at: new Date().toISOString() });
    return noContent();
  } catch (err) {
    return serverError(err, "Could not record event");
  }
}
