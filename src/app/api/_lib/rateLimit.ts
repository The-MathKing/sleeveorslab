// Simple fixed-window, in-memory, per-IP rate limiter. Process-local (good enough for a
// single host / dev; on serverless each instance limits independently).
import { jsonError } from "./http";

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export const LIMITS = {
  search: { name: "search", max: 30, windowMs: 60_000 },
  read: { name: "read", max: 120, windowMs: 60_000 },
  waitlistPost: { name: "waitlist-post", max: 5, windowMs: 60_000 },
  predictionsPost: { name: "predictions-post", max: 5, windowMs: 60_000 },
  outcomePost: { name: "outcome-post", max: 30, windowMs: 60_000 },
  events: { name: "events", max: 120, windowMs: 60_000 },
  admin: { name: "admin", max: 60, windowMs: 60_000 },
} as const;

export type Limit = (typeof LIMITS)[keyof typeof LIMITS];

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Returns a 429 Response when over the limit, otherwise null. */
export function rateLimit(req: Request, limit: Limit, now = Date.now()): Response | null {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  const key = `${limit.name}:${clientIp(req)}`;
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + limit.windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > limit.max) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return jsonError(429, "Too many requests, slow down", { "Retry-After": String(retry) });
  }
  return null;
}
