# Sleeve or Slab — Architecture

"The app that tells you when not to grade." A PWA that answers: is this Pokémon card worth grading, and with whom?

## Stack
- Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`).
- `zod` for API validation, `lucide-react` for icons, `idb-keyval` for on-device storage, `tesseract.js` (optional OCR for card number), `vitest` for tests.
- No accounts in v0. Scans and photos never leave the device unless the user explicitly logs a public prediction (card + verdict only, never the photo).

## Module ownership (one owner per directory)
| Path | Owner | Notes |
|---|---|---|
| `src/lib/types.ts` | lead | Shared contract. Don't change shapes without telling the lead. |
| `src/lib/grading/`, `src/lib/ev/`, `src/lib/centering/` | engines | Pure TS, no DOM, no network. Tests in `*.test.ts` beside the code. |
| `src/lib/cards/`, `src/lib/prices/`, `src/lib/db/`, `src/app/api/**` | data | Server only. |
| `src/components/brand/`, `src/components/ui/`, `public/**`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(marketing)/**`, `src/app/manifest.ts`, `src/app/icon*`, `src/app/apple-icon*`, `src/app/opengraph-image*` | brand | Logo, favicon, design system, marketing + legal pages, PWA manifest/service worker. |
| `src/components/scan/`, `src/lib/store/`, `src/app/(app)/**` | flows | Scan → verdict flow, binder triage, receipts log, collection, share cards. |

Each `index.ts` under `src/lib/*` currently holds `declare` signatures = the contract. Owners replace them with real implementations keeping the same exported names and types (adding more exports is fine).

## Routes
Marketing (brand): `/` landing with live centering demo, `/how-it-works`, `/fees`, `/pricing`, `/privacy`, `/terms`, `/disclaimer`.
App (flows): `/scan` (single card), `/binder` (batch triage), `/receipts` (public prediction log), `/receipts/[id]`, `/collection` (on-device).

## API (data)
All JSON, zod-validated, errors as `{ error: string }` with proper status.
- `GET /api/cards/search?q=charizard 199&limit=20` → `{ cards: CardRef[] }`
- `GET /api/cards/[id]` → `{ card: CardRef }`
- `GET /api/prices/[cardId]` → `{ price: PriceQuote }`
- `POST /api/waitlist` body `{ email, source?, consentMarketing }` → `{ ok, duplicate, count }`
- `GET /api/waitlist/count` → `{ count }`
- `POST /api/predictions` body `Omit<Prediction,"id"|"createdAt">` → `{ prediction }`
- `GET /api/predictions?limit=50` → `{ predictions: Prediction[] }` (public only)
- `GET /api/predictions/[id]` → `{ prediction }`
- `POST /api/predictions/[id]/outcome` body `{ grade, certNumber? }` → `{ prediction }`
- `GET /api/share?saved=720&cards=12` → PNG share card (next/og) — owned by flows, at `src/app/api/share/route.tsx`.

## Env
See `.env.example`. Everything works with zero keys (pokemontcg.io allows low-rate keyless use; prices fall back to TCGplayer data embedded in pokemontcg.io responses, graded prices fall back to labelled estimates).

## Honesty rules (product requirements, not marketing)
- Say "PSA-style grade estimate". Never imply affiliation with PSA, CGC, Nintendo, The Pokémon Company.
- Every verdict shows its assumptions and a probability range, never a promised grade.
- Any estimated number (graded prices, gem-rate priors) is visibly labelled "estimate".
- Fee table carries a "last verified" date and lives in one config file.
- Footer disclaimer on every page: "Estimates, not financial advice. Not affiliated with PSA, CGC, or The Pokémon Company."
