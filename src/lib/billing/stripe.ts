// Stripe client factory. Lazily constructed per secret key, so a key pasted in the admin tab
// takes effect without a redeploy. Never import this from client components.
import Stripe from "stripe";

const clients = new Map<string, Stripe>();

export function stripeClient(secretKey: string): Stripe {
  let c = clients.get(secretKey);
  if (!c) {
    c = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 15_000,
      appInfo: { name: "sleeveorslab", url: "https://www.sleeveorslab.com" },
    });
    if (clients.size > 4) clients.clear(); // keys rarely change; don't keep stale ones around
    clients.set(secretKey, c);
  }
  return c;
}

/** Signature check only needs the webhook secret; no API key or network involved. */
export function constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export { Stripe };
