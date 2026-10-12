# Billing (Pro + scan packs) — Stripe

Payments are **off** until the admin switches them on in `/admin → Billing`. While they're off, every
paid CTA shows the waitlist, `/api/billing/checkout` answers 409, and nothing else changes.

| Plan | Price | What you get | Stripe |
|---|---|---|---|
| Free | $0 | Card ID, centering, 3 verdicts/day | — |
| Pro (`pro-monthly`) | $6.99 / month | Unlimited verdicts, binder triage, price alerts later | recurring Price, lookup_key `sos_pro_monthly` |
| Scan pack (`pack-100`) | $19 once | 100 verdict/binder-scan credits, never expire | one-time Price, lookup_key `sos_pack_100` |

The single source of truth is `src/lib/billing/plans.ts`. The pricing page, the upgrade panel and
"Create products & prices" all read it. To change a price, edit it there and press "Create products &
prices" again: Stripe prices are immutable, so a new Price is created, the lookup_key moves to it, and
the old one is archived. Existing subscribers stay on their old price until you migrate them in Stripe.

---

## Owner setup, in order

1. **Guardian-owned Stripe account.** The plan requires a parent or legal guardian to own the Stripe
   account (Stripe needs an adult to accept its terms and receive payouts). Create it at
   dashboard.stripe.com under their name. Don't take real payments from an account in your own name.
2. **Stay in test mode first.** Toggle "Test mode" on in the Stripe dashboard. Everything below is done
   once in test mode, then again in live mode.
3. **Keys.** Developers → API keys → copy the *secret* key (`sk_test_…`; a restricted `rk_test_…` key
   also works if it has write access to Checkout Sessions, Customers, Products, Prices, Subscriptions,
   Billing Portal and read access to the Account). Either:
   - paste it into `/admin → Billing → 1 · Stripe keys` (stored encrypted with AES-256-GCM, key derived
     from `BILLING_ENCRYPTION_KEY`, or from `ADMIN_TOKEN` if that isn't set), **or**
   - set `STRIPE_SECRET_KEY` in Vercel → Project → Settings → Environment Variables and redeploy.
   Env vars win over the admin tab. Recommended: also set `BILLING_ENCRYPTION_KEY` (any long random
   string, e.g. `openssl rand -base64 32`) so rotating `ADMIN_TOKEN` doesn't wipe stored keys or sign
   every buyer out.
4. **Test connection.** Shows the account name, country, and whether it can take charges yet
   ("Can take payments: no" is normal for a fresh live account until Stripe's onboarding is done).
5. **Create products & prices.** Creates (or finds) "Sleeve or Slab Pro" $6.99/month and "Sleeve or
   Slab 100-scan pack" $19 one-time, and stores their price ids. Safe to press again.
6. **Webhook.** Stripe → Developers → Webhooks → Add endpoint:
   - URL: `https://www.sleeveorslab.com/api/stripe/webhook` (the admin tab shows it with a copy button)
   - Events, exactly these four:
     `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_failed`
   - Copy the endpoint's **signing secret** (`whsec_…`) into the admin tab (or `STRIPE_WEBHOOK_SECRET`).
7. **Customer portal.** Stripe → Settings → Billing → Customer portal: turn on "Cancel subscriptions"
   (cancel at end of period), "Update payment methods" and "Invoice history", and leave the
   cancellation-reason survey **off** (we promise "cancel in two clicks"). Save. Do this in both modes.
8. **Turn on payments (test mode)** with the "Payments enabled" switch. It stays disabled until a key,
   the webhook secret, and prices exist.
9. **Test a purchase** at `/pricing` with card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
   Check: you land on `/pricing/success`, the plan shows, `/pricing` says "Your plan", "Manage
   subscription" opens the portal, cancelling there flips the plan back after the period ends (use Stripe
   "test clocks" to fast-forward), and the admin "Numbers" card counts it. Try `4000 0000 0000 0341` to
   see a failed renewal (`past_due`). Try the pack too, and "Restore purchase" from a private window.
10. **Go live.** Switch the Stripe dashboard to live mode, complete account activation (guardian's
    details, bank account), then repeat steps 3–7 with `sk_live_…` and a live webhook endpoint.
    Saving a new secret key turns payments off and clears price ids on purpose, so press
    "Create products & prices" again, then flip "Payments enabled". The admin tab shows a warning in
    live mode as a last check that the account is guardian-owned.

Optional env vars:

| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Override the admin-tab keys |
| `BILLING_ENCRYPTION_KEY` | Root for HKDF (encryption + token signing). Falls back to `ADMIN_TOKEN` |
| `RESEND_API_KEY` | Enables emailed restore links. Without it, restore says "email hello@sleeveorslab.com" |
| `RESEND_FROM` | Sender, default `Sleeve or Slab <hello@sleeveorslab.com>` (domain must be verified in Resend) |
| `NEXT_PUBLIC_SITE_URL` | Origin used in restore emails (never the request's Host header). Defaults to `https://www.sleeveorslab.com` in production |

No Stripe Tax is configured, so the price on the button is what the buyer pays. If the guardian's
accountant later says tax must be collected, turn on Stripe Tax with *inclusive* prices so the shown
price still doesn't change.

---

## How entitlements work without accounts

- Checkout creates a Stripe Customer (subscription mode always does; payment mode uses
  `customer_creation: "always"`). Metadata `{app: "sleeveorslab", plan, variant}` goes on the session
  and subscription; events without `app=sleeveorslab` are ignored, so other products on the same
  Stripe account can't grant anything.
- `/pricing/success?session_id=…` calls `GET /api/billing/claim`, which retrieves the session from
  Stripe, checks `status=complete` and `payment_status=paid`, upserts the customer + purchase
  (idempotent on the session id; credits are granted in the same SQL statement as the purchase insert),
  and returns an **entitlement token**: `base64url(json{typ:"ent", cid, iat}).base64url(HMAC-SHA256)`.
  The HMAC key is HKDF-SHA256 from the root secret with its own `info` string. Claims work for 48h
  after checkout; after that, use Restore.
- The browser keeps the token in `localStorage["sos:billing-token"]`. The token only says *which
  customer*; the **database is the source of truth** for plan, status, period end and credits, so a
  cancelled Pro or spent pack is reflected immediately without re-issuing tokens.
- The webhook keeps the DB current: subscription status, `current_period_end` (read from the
  subscription item, per Stripe API 2025-03-31+) and `cancel_at_period_end`. It dedupes by event id
  (`stripe_events`), re-fetches the subscription from Stripe so out-of-order events can't regress state,
  and releases the event id if a handler throws so Stripe's retry runs. `past_due` keeps Pro working
  while Stripe retries the card; `unpaid`/`canceled` end it.
- **Restore** (new phone, cleared storage): `/pricing/restore` → `POST /api/billing/restore {email}`.
  If Resend is configured and the email has a purchase, we email a 30-minute signed link
  (`/pricing/restore?t=…`, separate HKDF key); the page exchanges it for a fresh entitlement token. The
  response is identical whether or not the email exists, and the lookup + send happen after the
  response (`after()`), so timing doesn't leak it either. Rate-limited to 3/15 min per IP plus a
  2-minute per-email cooldown.
- If one email has several Stripe customers (bought before restoring), restore picks the active Pro
  one, else the one with the most credits. Buying while holding a token reuses that customer, so this
  is rare.
- Rotating `BILLING_ENCRYPTION_KEY` (or `ADMIN_TOKEN` without it) invalidates all tokens; buyers use
  Restore. Their purchases are untouched.

Tables (own schema, created on first use, same Postgres as the rest of the app):
`billing_settings` (single row: encrypted keys + last4 + mode, `payments_enabled`, `price_ids`,
`split_test`), `customers`, `purchases`, `stripe_events`. Local dev without `DATABASE_URL` uses
`./.data/billing.json`.

### Endpoints

Public (all rate-limited, zod-validated, and degrade when Stripe isn't configured):

| Method | Path | Notes |
|---|---|---|
| GET | `/api/billing/config` | `{enabled, mode, splitTest, plans}`; never errors |
| POST | `/api/billing/checkout` | `{plan, variant?}` (+ optional Bearer) → `{url}`; 409 while off or if already Pro |
| GET | `/api/billing/claim?session_id=` | → `{token, plan, entitlement}` |
| GET | `/api/billing/me` | Bearer → `{plan, status, isPro, creditsRemaining, renewsAt, endsAt}` (no Stripe needed) |
| POST | `/api/billing/consume` | Bearer, `{count}` → `{ok, creditsRemaining, unlimited}` or 402 |
| POST | `/api/billing/portal` | Bearer → `{url}`; works even with payments off, so anyone can cancel |
| POST | `/api/billing/restore` | `{email}` → generic message |
| GET | `/api/billing/restore?t=` | → `{token, entitlement}` |
| POST | `/api/stripe/webhook` | Stripe only (signature-verified on the raw body) |

Admin (`x-admin-token`): `GET|POST /api/admin/billing/settings`, `POST /api/admin/billing/test`,
`POST /api/admin/billing/sync-products`, `GET /api/admin/billing/summary`.

### Pricing test

When "Pricing test" is on, each browser is assigned `monthly-first` or `pack-first`
(`localStorage["sos:pricing-variant"]`, 50/50, sticky). Only order and the gold highlight change;
prices never do. The variant goes into checkout metadata and the `purchases` table, and the admin
"Numbers" card shows purchases and revenue per variant (30 days). Visitor counts per arm aren't
tracked here; compare against `/pricing` views in analytics.

---

## Wiring for the lead

Everything is exported from `@/components/billing`.

### Admin tab

```tsx
import { BillingPanel } from "@/components/billing";
// inside the admin tabs, once the token is known:
{ id: "billing", label: "Billing", content: <BillingPanel adminToken={token} /> }
```

### `src/components/scan/VerdictView.tsx`

Replace the soft-limit `EmailCapture` and spend a pack credit for verdicts past the free 3:

```tsx
import { UpgradePanel, useEntitlement } from "@/components/billing";

// inside the component, next to the existing gate state:
const ent = useEntitlement();
const [paidOk, setPaidOk] = useState<boolean | null>(null); // null = not needed / not checked yet

// after setGate({ firstInSession, count }) in the counting effect:
//   if (count > FREE_VERDICTS_PER_DAY) void ent.consume(1).then((r) => setPaidOk(r.ok));
// consume() is ok (and spends nothing) for active Pro; spends 1 credit for packs; ok=false otherwise.
// Add `ent.consume` to that effect's dependency list (it's stable unless the credit count changes;
// the `counted` ref already keeps it to one call per mount).

// in the JSX, replace the first branch of the soft-limit ternary:
{gate && gate.count > FREE_VERDICTS_PER_DAY && paidOk === false ? (
  <UpgradePanel source="soft-limit" count={gate.count} hideWaitlist={waitlistJoined()} />
) : gate?.firstInSession && !waitlistJoined() && !waitlistDismissed() ? (
  <EmailCapture /* ...unchanged "after-first-verdict" capture... */ />
) : null}
```

`UpgradePanel` shows the old "Pro is coming — join the waitlist" message (with `WaitlistForm`)
while payments are off (nothing if `hideWaitlist`), the plan buttons when on, and nothing for Pro users. The limit stays soft
either way (the verdict is already on screen); making it hard is a separate product decision.

### `src/components/scan/Binder.tsx`

Binder triage is a paid feature. Before running triage over `n` cards:

```tsx
import { UpgradePanel, useEntitlement } from "@/components/billing";

const ent = useEntitlement();
// when the user starts triage over `cards`:
const r = await ent.consume(cards.length); // Pro: always ok; pack: spends n credits atomically
if (!r.ok) setShowUpgrade(true);           // and don't run (or run only the free first few, your call)

// render:
{showUpgrade && <UpgradePanel source="binder" context="binder" />}
```

`ent.credits` / `ent.isPro` / `ent.loading` are available for copy like "Uses 12 of your 88 credits".
