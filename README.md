# Sleeve or Slab

**The app that tells you when not to grade.** Snap a Pokémon card, check its centering on-device, and get an expected-value verdict (SLAB IT / SLEEVE IT / BORDERLINE) for PSA and CGC, with every fee and assumption shown.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: engines, data layer, centering detector
npm run build
```

No API keys needed to start. Optional env vars are in `.env.example` (pokemontcg.io key for higher rate limits, PriceCharting key for real graded prices, `ADMIN_TOKEN` for recording verified grades).

## What's in it

| Route | What it does |
|---|---|
| `/` | Landing page with a live, on-device centering demo |
| `/scan` | Front/back photo → centering → card search (+ optional OCR) → condition check → verdict |
| `/binder` | Batch triage: paste a list, ranked by expected profit, CSV export |
| `/receipts` | Public prediction log, published before grades come back |
| `/collection` | Saved cards, stored on your device only |
| `/fees`, `/how-it-works`, `/pricing`, `/privacy`, `/terms`, `/disclaimer` | Marketing and legal |

Architecture and module ownership: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Brand guide: [`docs/BRAND.md`](docs/BRAND.md). Fees live in one file: [`src/lib/grading/fees.ts`](src/lib/grading/fees.ts).

## Before launch

- **Storage:** set `DATABASE_URL` to a Postgres database (Vercel → Storage → Neon). Tables are created automatically on first request. Without it, data goes to `.data/*.json`, which doesn't persist on Vercel.
- **Deletion requests:** `POST /api/admin/delete` with header `x-admin-token` and body `{"email": "..."}` or `{"predictionId": "R-0042"}`.
- **Fees:** values marked "Verify on grader site" in `fees.ts` need checking against PSA/CGC.
- **Recording outcomes:** visitors email their cert; an admin records it at `/receipts/<id>?admin=1` with `ADMIN_TOKEN`.

Estimates, not financial advice. Not affiliated with PSA, CGC, Nintendo, or The Pokémon Company.
