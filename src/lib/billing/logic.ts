// Pure-ish billing logic: building Checkout params, fulfilling sessions, applying webhook
// events, computing entitlements. Everything takes its dependencies as arguments so tests can
// drive it with hand-built Stripe objects and a PGlite/file store, no network.
import type Stripe from "stripe";
import { isPaidPlanId, isVariant, PLANS, type PaidPlanId, type PlanId, type PricingVariant } from "./plans";
import { isActiveSubStatus, type BillingStore, type CustomerRecord, type SubscriptionState } from "./store";

/** Tag on every Checkout Session / Subscription we create, so other products on the same Stripe account are ignored. */
export const APP_TAG = "sleeveorslab";

export interface BillingDeps {
  store: BillingStore;
  /** Fetch the latest subscription from Stripe (webhooks can arrive out of order). Optional. */
  retrieveSubscription?: (id: string) => Promise<Stripe.Subscription | null>;
}

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : (v?.id ?? null);

/* ---------------- checkout ---------------- */

export interface CheckoutInput {
  plan: PaidPlanId;
  variant: PricingVariant | null;
  priceId: string;
  origin: string;
  clientReferenceId: string;
  /** Existing Stripe customer (from a valid entitlement token) so purchases stack on one customer. */
  customerId?: string | null;
}

export function buildCheckoutParams(i: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const metadata: Record<string, string> = { app: APP_TAG, plan: i.plan, variant: i.variant ?? "none" };
  const base: Stripe.Checkout.SessionCreateParams = {
    line_items: [{ price: i.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: i.clientReferenceId,
    success_url: `${i.origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${i.origin}/pricing`,
    metadata,
    ...(i.customerId ? { customer: i.customerId } : {}),
  };
  if (PLANS[i.plan].billing === "subscription") {
    return { ...base, mode: "subscription", subscription_data: { metadata } };
  }
  return {
    ...base,
    mode: "payment",
    ...(i.customerId ? {} : { customer_creation: "always" as const }),
    payment_intent_data: { metadata },
  };
}

/* ---------------- subscriptions ---------------- */

export function subscriptionState(sub: Stripe.Subscription): SubscriptionState {
  // Since API 2025-03-31 the period lives on subscription items; we only ever have one item.
  const ends = (sub.items?.data ?? [])
    .map((it) => it.current_period_end)
    .filter((n): n is number => typeof n === "number");
  const end = ends.length ? Math.max(...ends) : null;
  return {
    subscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
}

export type ApplyResult = "applied" | "ignored-foreign" | "ignored-stale";

export async function applySubscription(sub: Stripe.Subscription, deps: BillingDeps): Promise<ApplyResult> {
  const customerId = idOf(sub.customer);
  if (!customerId) return "ignored-foreign";
  const existing = await deps.store.getCustomer(customerId);
  if (sub.metadata?.app !== APP_TAG && !existing) return "ignored-foreign";
  // A customer who re-subscribed: a late event about their old, ended subscription must not
  // clobber the active one.
  if (
    existing?.subscriptionId &&
    existing.subscriptionId !== sub.id &&
    isActiveSubStatus(existing.subscriptionStatus) &&
    !isActiveSubStatus(sub.status)
  ) {
    return "ignored-stale";
  }
  if (!existing || (sub.livemode && !existing.livemode)) await deps.store.upsertCustomer({ id: customerId, livemode: sub.livemode });
  await deps.store.setSubscription(customerId, subscriptionState(sub));
  return "applied";
}

async function freshSubscription(sub: Stripe.Subscription, deps: BillingDeps): Promise<Stripe.Subscription> {
  if (!deps.retrieveSubscription) return sub;
  try {
    return (await deps.retrieveSubscription(sub.id)) ?? sub;
  } catch {
    return sub;
  }
}

/* ---------------- checkout fulfillment (claim + webhook share this) ---------------- */

export type FulfillResult =
  | { ok: true; customerId: string; plan: PaidPlanId; inserted: boolean }
  | { ok: false; reason: "not-ours" | "not-paid" | "no-customer" };

export function sessionIsPaid(s: Pick<Stripe.Checkout.Session, "status" | "payment_status">): boolean {
  return s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required");
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session, deps: BillingDeps): Promise<FulfillResult> {
  if (session.metadata?.app !== APP_TAG) return { ok: false, reason: "not-ours" };
  if (!sessionIsPaid(session)) return { ok: false, reason: "not-paid" };
  const customerId = idOf(session.customer);
  if (!customerId) return { ok: false, reason: "no-customer" };

  const metaPlan = session.metadata?.plan;
  const plan: PaidPlanId = isPaidPlanId(metaPlan) ? metaPlan : session.mode === "subscription" ? "pro-monthly" : "pack-100";
  const variant = isVariant(session.metadata?.variant) ? session.metadata.variant : null;

  await deps.store.upsertCustomer({ id: customerId, email: session.customer_details?.email ?? null, livemode: session.livemode });
  const { inserted } = await deps.store.recordPurchase({
    id: session.id,
    customerId,
    plan,
    variant,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    credits: PLANS[plan].billing === "one-time" ? (PLANS[plan].credits ?? 0) : 0,
    livemode: session.livemode,
    createdAt: session.created ? new Date(session.created * 1000).toISOString() : undefined,
  });

  if (session.mode === "subscription") {
    const subRef = session.subscription;
    const subId = idOf(subRef);
    if (subId) {
      let sub: Stripe.Subscription | null = typeof subRef === "object" && subRef ? subRef : null;
      if (!sub && deps.retrieveSubscription) sub = await deps.retrieveSubscription(subId).catch(() => null);
      if (sub) {
        await applySubscription(sub, deps);
      } else {
        const existing = await deps.store.getCustomer(customerId);
        // Paid + complete means the subscription is active; period end arrives with the next subscription event.
        if (existing?.subscriptionId !== subId) {
          await deps.store.setSubscription(customerId, { subscriptionId: subId, status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false });
        }
      }
    }
  }
  return { ok: true, customerId, plan, inserted };
}

/* ---------------- webhook ---------------- */

export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export interface WebhookOutcome {
  duplicate: boolean;
  handled: boolean;
  detail?: string;
}

/** Apply one verified event. Idempotent per event id; on failure the id is released so Stripe's retry runs. */
export async function processWebhookEvent(event: Stripe.Event, deps: BillingDeps): Promise<WebhookOutcome> {
  if (!(await deps.store.beginEvent(event.id, event.type))) return { duplicate: true, handled: false };
  try {
    return { duplicate: false, ...(await handleStripeEvent(event, deps)) };
  } catch (err) {
    await deps.store.forgetEvent(event.id).catch(() => {});
    throw err;
  }
}

export async function handleStripeEvent(event: Stripe.Event, deps: BillingDeps): Promise<{ handled: boolean; detail?: string }> {
  switch (event.type) {
    case "checkout.session.completed": {
      const r = await fulfillCheckoutSession(event.data.object as Stripe.Checkout.Session, deps);
      return { handled: r.ok, detail: r.ok ? (r.inserted ? "fulfilled" : "already-fulfilled") : r.reason };
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = await freshSubscription(event.data.object as Stripe.Subscription, deps);
      const r = await applySubscription(sub, deps);
      return { handled: r === "applied", detail: r };
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = idOf(inv.parent?.subscription_details?.subscription ?? null);
      if (!subId) return { handled: false, detail: "no-subscription" };
      if (deps.retrieveSubscription) {
        const sub = await deps.retrieveSubscription(subId).catch(() => null);
        if (sub) {
          const r = await applySubscription(sub, deps);
          return { handled: r === "applied", detail: r };
        }
      }
      const existing = await deps.store.findCustomerBySubscription(subId);
      if (!existing) return { handled: false, detail: "unknown-subscription" };
      // Stripe keeps retrying the card; access continues while past_due (shown honestly as such).
      if (isActiveSubStatus(existing.subscriptionStatus)) {
        await deps.store.setSubscription(existing.id, {
          subscriptionId: subId,
          status: "past_due",
          currentPeriodEnd: existing.currentPeriodEnd,
          cancelAtPeriodEnd: existing.cancelAtPeriodEnd,
        });
      }
      return { handled: true, detail: "past_due" };
    }
    default:
      return { handled: false, detail: "ignored" };
  }
}

/* ---------------- entitlements ---------------- */

export interface Entitlement {
  plan: PlanId;
  /** Subscription status when Pro; "credits" for a pack balance; "canceled" etc. after Pro ends; "none" otherwise. */
  status: string;
  isPro: boolean;
  creditsRemaining: number;
  /** Next renewal when Pro and not cancelling. */
  renewsAt: string | null;
  /** When Pro ends, if cancelled at period end. */
  endsAt: string | null;
}

export function entitlementFor(c: CustomerRecord | null): Entitlement {
  if (!c) return { plan: "free", status: "none", isPro: false, creditsRemaining: 0, renewsAt: null, endsAt: null };
  const isPro = isActiveSubStatus(c.subscriptionStatus);
  return {
    plan: isPro ? "pro-monthly" : c.credits > 0 ? "pack-100" : "free",
    status: isPro ? c.subscriptionStatus! : c.credits > 0 ? "credits" : (c.subscriptionStatus ?? "none"),
    isPro,
    creditsRemaining: c.credits,
    renewsAt: isPro && !c.cancelAtPeriodEnd ? c.currentPeriodEnd : null,
    endsAt: isPro && c.cancelAtPeriodEnd ? c.currentPeriodEnd : null,
  };
}

/** For restore: when one email maps to several Stripe customers, pick the most valuable. */
export function bestCustomer(cs: CustomerRecord[]): CustomerRecord | null {
  if (!cs.length) return null;
  return [...cs].sort((a, b) => {
    const pa = isActiveSubStatus(a.subscriptionStatus) ? 1 : 0;
    const pb = isActiveSubStatus(b.subscriptionStatus) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (a.credits !== b.credits) return b.credits - a.credits;
    return b.createdAt.localeCompare(a.createdAt);
  })[0]!;
}
