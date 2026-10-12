# Sleeve or Slab: Brand Guide

**Positioning:** The app that tells you when not to grade.

**Taglines** (rotate; never stack more than one):
- Save the $60.
- Most cards should stay sleeved.
- Do the math before you slab.

**Personality:** a blunt, math-literate friend at the card shop. Honest, a bit dry, never hype. This friend has watched people lose money on grading for years and would rather you didn't.

---

## 1. Palette

Tokens live in `src/app/globals.css`. Use the Tailwind classes (`bg-paper`, `text-ink`, `bg-sleeve-soft`, `text-slab-ink`, `border-line`…), not raw hex. The names are a shared contract: change values, never rename.

| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#f6f4ee` | `#101216` | Page background (card stock) |
| `paper-2` | `#ece9e0` | `#171a20` | Alternate section bands, table heads |
| `card` | `#fffefb` | `#1b1f26` | Raised surfaces |
| `receipt` | `#fdfcf7` | `#1e2229` | Receipt/verdict surfaces |
| `ink` | `#15171c` | `#f1efe9` | Text, primary buttons |
| `ink-2` | `#474c58` | `#b8bcc7` | Body copy |
| `ink-3` | `#7c818d` | `#868b99` | Labels, captions |
| `line` / `line-strong` | `#dcd8cc` / `#c4bfb0` | `#2b3039` / `#3b414c` | Hairlines, dashed rules |
| `sleeve` | `#5b7a99` | `#8fb0d0` | SLEEVE: clear-plastic blue-gray |
| `sleeve-soft` / `sleeve-ink` / `sleeve-deep` | `#e3eaf1` / `#2c4560` / `#3f5d7c` | `#1d2a38` / `#c8daec` / `#a9c4df` | Tints, text on tint, stamp ink |
| `slab` | `#c9971c` | `#e8b93a` | SLAB: gold, the rare yes |
| `slab-soft` / `slab-ink` / `slab-deep` | `#f8edd0` / `#6b4d05` / `#9c7008` | `#33280c` / `#f6dc94` / `#f0c552` | Tints, text on tint, stamp ink |
| `borderline` | `#d9741e` | `#f0954a` | BORDERLINE: amber |
| `borderline-soft` / `borderline-ink` | `#fbe6d3` / `#8a4209` | `#3a2413` / `#fbc597` | |
| `good` / `bad` | `#2f8f5b` / `#c0392b` | `#4cc488` / `#ef6b5b` | Money sign coloring only |
| `focus` | `#2f6fd6` | `#7fb0ff` | Focus rings |

**Rules**
- Sleeve blue-gray is the default. Most screens should feel mostly paper, ink, and sleeve.
- Gold is earned. Use `slab` for SLAB verdicts, the Pro tier, and the occasional "this one's worth it" highlight. If gold is everywhere it stops meaning anything.
- Green and red are for money only (gain/loss). Don't use them for verdicts; a SLEEVE verdict isn't a failure.
- Grade charts use a fixed ramp: 10 = gold, 9 = pale gold, 8 = sleeve, 7 = pale sleeve, 6 = ink-3, ≤5 = line-strong.

## 2. Type

| Role | Face | CSS var | Tailwind |
|---|---|---|---|
| Display | Barlow Condensed 600–800, uppercase | `--font-display-face` | `font-display` |
| Body/UI | Inter | `--font-sans-face` | `font-sans` (default) |
| Numbers | JetBrains Mono, tabular | `--font-mono-face` | `font-mono` |

- Headlines: `font-display font-extrabold uppercase`, tight leading (0.88–0.95).
- **Every number is monospace.** Dollar amounts, percentages, grades in tables, cert numbers. Money should read like a receipt and line up in columns. Use `<Money/>` and `<Stat/>`.
- Small labels/eyebrows: mono, 0.7rem, uppercase, letter-spacing 0.16–0.2em, `text-ink-3` (like the header strip on a slab label).
- Use a real minus sign (−) for negative money. `formatUsd` does this.

## 3. Logo

Files: `src/components/brand/Logomark.tsx` (`Logomark`, `LogomarkSimple`), `Wordmark.tsx` (`Wordmark`, `Logo` lockup), static versions in `markSvg.ts`, `src/app/icon.svg`, `public/icons/*`.

**The mark** is a trading card at true 63:88 aspect. The left half is a penny sleeve (translucent blue-gray plastic, open lip at the top, sheen stripe). The right half is a slab (gold frame, label strip). The inner art frame sits 55/45 off-center, and a dashed centering guide with a crosshair marks the true center. It's the whole product in one picture: measure the card, then decide which side it belongs on.

- `Logomark` for 24px and up. `LogomarkSimple` (two-tone card, one inner frame, no dashes) for 16–24px and favicons.
- Clear space: at least half the mark's width on all sides.
- Don't recolor the halves, swap them, rotate the mark, add drop shadows, or center the inner frame (it's off-center on purpose).
- On photos or busy art, put the mark on a `paper` or `card` tile.

**Wordmark:** "SLEEVE *or* SLAB": condensed extrabold caps, with "or" small, italic, lowercase, in `ink-2`. The series title adds a gold question mark: "Sleeve or Slab?" (`<Wordmark question />`).

## 4. Verdict language

Three verdicts, always in these exact words, always as a stamp (`<VerdictStamp verdict=… />`):

| Verdict | Stamp | Kicker | Means |
|---|---|---|---|
| `SLEEVE` | **SLEEVE IT.** | KEEP IT RAW | Expected gain from grading is negative, or depends on a long-shot 10. |
| `BORDERLINE` | **BORDERLINE** | COIN FLIP | Near break-even, or it swings on an assumption the user should check. |
| `SLAB` | **SLAB IT.** | WORTH THE FEE | Positive expected gain with a reasonable chance of not losing money. |

- Lead with the money: "Grading vs. raw: −$61.03." Then probability of loss, then the break-even grade.
- Say "PSA-style grade estimate" or "estimated PSA odds", never "your PSA grade".
- Grades are distributions. "Most likely a 9 (52%)", never "This is a 9."
- Never celebrate a SLAB verdict with confetti energy. "The math says grade it. Here's the tier." is plenty.

## 5. Voice and tone

The friend at the counter: knows the numbers, tells you straight, doesn't need you to like it.

**Do**
- Be short and specific. "Only a 10 beats raw, and you have an 18% shot."
- Show the arithmetic. If there's a number, there's a breakdown one tap away.
- Use collector vocabulary naturally: raw, pulls, pack fresh, whitening, print lines, top-loader, submission, pop report, gem rate.
- Be dry, not mean. "That's a binder card. Sleeve it and enjoy it."
- Admit uncertainty plainly. "We can't see surface scratches in a photo."

**Don't**
- Hype: no "🚀", "insane", "moon", "gem guaranteed", "AI-powered grading".
- Mock people for having graded bad cards. Everyone has.
- Imply affiliation with PSA, CGC, Nintendo, or The Pokémon Company, or use their logos.
- Give investment language: "buy", "hold", "ROI guaranteed", "portfolio".
- Use exclamation marks in product UI. One, maybe, on a SLAB verdict share card.

| Instead of | Write |
|---|---|
| "Our AI graded your card a PSA 10!" | "Centering allows a 10. Estimated odds of a 10: 22%." |
| "Unlock your collection's hidden value!" | "Most cards should stay sleeved. Let's find the ones that shouldn't." |
| "Oops! Something went wrong." | "Couldn't reach the price database. Try again in a minute." |
| "Grade with confidence!" | "Do the math before you slab." |

## 6. Series (content, social, newsletter)

| Series | Format |
|---|---|
| **Sleeve or Slab?** | The flagship. One real card, one verdict, the full receipt. Short video or carousel ending on the stamp. |
| **Binder Audit** | Run a viewer's whole binder or submission pile; count how many deserved grading and the dollars saved. |
| **Receipts** | Our logged predictions vs. actual returned grades. Misses get posted with the same energy as hits. |
| **Off-Center** | Centering deep-dives: a set's typical centering, how to measure, why 55/45 matters. |
| **Gem Rate Friday** | Weekly look at gem rates and pop data for a set, and what it means for whether to grade. Also the newsletter opt-in name. |

## 7. Honesty rules (product requirements, not marketing)

1. Say "PSA-style grade estimate". Never imply affiliation with PSA, CGC, Nintendo, or The Pokémon Company.
2. Every verdict shows its assumptions and a probability range, never a promised grade.
3. Every estimated number (graded prices, gem-rate priors) is visibly labelled "estimate" (`<EstimateBadge/>`, `<Stat estimate />`).
4. The fee table carries a "last verified" date and lives in one config file (`src/lib/grading`).
5. Footer disclaimer on every page: "Estimates, not financial advice. Not affiliated with PSA, CGC, Nintendo, or The Pokémon Company."
6. Example data on marketing pages is labelled "example" and is internally consistent arithmetic (see `src/components/brand/exampleData.ts`).
7. We publish misses on Receipts. We never delete a logged prediction because it looks bad.
8. We don't claim accuracy numbers we haven't measured on Receipts.

## 8. Texture and motion

- Surfaces: card stock (faint grain on `body`), penny sleeve (`.sleeve-sheen`, cool tint), slab (3px gold border, `Card variant="slab"`), receipt paper (`Card variant="receipt"`, zig-zag torn edge, dotted leaders via `.leader`).
- Stamps rotate −4° to −9° and use an SVG turbulence filter for ink texture. `backing` adds a faint paper patch over busy art.
- Motion is small and physical: the stamp "thunk" (scale 1.9 → 0.92 → 1), bars growing, sections rising 14px. All motion is gated on `prefers-reduced-motion: no-preference`.
- Focus is always visible: 2px `focus` outline, 2px offset.
