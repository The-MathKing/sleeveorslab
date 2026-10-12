import { NextResponse } from "next/server";
import type { z } from "zod";

export function jsonError(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers });
}

export function zodMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid request";
  const where = issue.path.length ? issue.path.join(".") + ": " : "";
  return where + issue.message;
}

const MAX_BODY_BYTES = 16 * 1024; // no route accepts images; keep bodies small

/** Read + JSON-parse a request body with a size cap. Returns a Response on failure. */
export async function readJsonBody(req: Request): Promise<{ ok: true; data: unknown } | { ok: false; res: Response }> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return { ok: false, res: jsonError(413, "Request body too large") };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, res: jsonError(400, "Could not read request body") };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, res: jsonError(413, "Request body too large") };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, res: jsonError(400, "Body must be valid JSON") };
  }
}

export function serverError(err: unknown, publicMessage = "Internal error") {
  console.error("[api]", err);
  return jsonError(500, publicMessage);
}
