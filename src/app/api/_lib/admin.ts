import { createHash, timingSafeEqual } from "node:crypto";
import { jsonError } from "./http";

function tokenMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Returns an error response unless the request carries x-admin-token === ADMIN_TOKEN. */
export function requireAdmin(req: Request): Response | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return jsonError(403, "Admin actions are disabled (ADMIN_TOKEN not configured)");
  const given = req.headers.get("x-admin-token");
  if (!given || !tokenMatches(given, expected)) return jsonError(401, "Unauthorized");
  return null;
}
