// Billing rate limits, using the shared in-memory limiter from src/app/api/_lib.
import type { Limit } from "../../_lib/rateLimit";

const limit = (name: string, max: number, windowMs: number) => ({ name, max, windowMs }) as unknown as Limit;

export const BILLING_LIMITS = {
  config: limit("billing-config", 60, 60_000),
  checkout: limit("billing-checkout", 10, 60_000),
  claim: limit("billing-claim", 20, 60_000),
  me: limit("billing-me", 60, 60_000),
  consume: limit("billing-consume", 60, 60_000),
  portal: limit("billing-portal", 10, 60_000),
  restoreRequest: limit("billing-restore-req", 3, 15 * 60_000),
  restoreExchange: limit("billing-restore-x", 10, 15 * 60_000),
  webhook: limit("stripe-webhook", 300, 60_000),
  admin: limit("billing-admin", 60, 60_000),
};
