// Shared domain types. This file is the contract between modules — change it
// only with care, since engines, data, and UI all import from here.

export type GraderId = "PSA" | "CGC";

/** Numeric grade on a 1–10 scale. CGC "Pristine 10" is modelled as grade 10 with pristine=true. */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Finish = "holo" | "reverse-holo" | "non-holo" | "full-art" | "unknown";

export type Era = "modern" | "sword-shield" | "sun-moon" | "xy" | "older";

export interface CardRef {
  /** Provider id, e.g. pokemontcg.io id "sv3pt5-199" */
  id: string;
  name: string;
  setId: string;
  setName: string;
  number: string;
  rarity?: string;
  releaseDate?: string; // ISO yyyy-mm-dd
  imageSmall?: string; // hot-linked from provider, never re-hosted
  imageLarge?: string;
  finish?: Finish;
}

/** Prices in USD. Any field may be missing when the provider lacks it. */
export interface PriceQuote {
  cardId: string;
  raw?: number; // ungraded near-mint market price
  graded: Partial<Record<GraderId, Partial<Record<Grade, number>>>>;
  source: "pricecharting" | "tcgplayer-via-pokemontcg" | "manual" | "estimate";
  asOf: string; // ISO timestamp
  /** True when graded values are heuristic multipliers rather than market data. */
  gradedIsEstimate: boolean;
}

/** Centering ratios expressed as the larger side's share, e.g. 0.55 means 55/45. */
export interface CenteringMeasurement {
  leftRight: number; // 0.5 .. 1.0
  topBottom: number; // 0.5 .. 1.0
  /** Raw border widths in px, useful for overlays. */
  borders: { left: number; right: number; top: number; bottom: number };
  /** Card outer quad and inner (artwork frame) quad in image pixel coords. */
  outer: Quad;
  inner: Quad;
  confidence: number; // 0..1, from auto-detection; 1 when user-adjusted
  method: "auto" | "manual";
}

export interface Point { x: number; y: number }
export interface Quad { tl: Point; tr: Point; br: Point; bl: Point }

export interface CenteringResult {
  front?: CenteringMeasurement;
  back?: CenteringMeasurement;
}

/** Highest grade each grader permits given measured centering. */
export interface CenteringCap {
  grader: GraderId;
  maxGrade: Grade;
  label: string; // e.g. "PSA 10 eligible", "Caps at PSA 9"
  pristineEligible?: boolean; // CGC only
}

export interface GradingTier {
  grader: GraderId;
  id: string; // e.g. "psa-standard"
  name: string;
  feeUsd: number;
  maxDeclaredValueUsd?: number;
  turnaroundBusinessDays: [number, number];
  minCards?: number;
  available: boolean;
  notes?: string;
}

export type GradeDistribution = Partial<Record<Grade, number>>; // probabilities summing to 1

export type Verdict = "SLAB" | "SLEEVE" | "BORDERLINE";

export interface EVInput {
  card: CardRef;
  price: PriceQuote;
  centering?: CenteringResult;
  grader: GraderId;
  tierId: string;
  /** User override of the per-card/set gem rate (P(10)). */
  gemRateOverride?: number;
  /** Shipping + insurance per card, both directions, USD. */
  shippingPerCardUsd?: number;
  /** Selling fees as a fraction (eBay ~0.13). */
  sellingFeeRate?: number;
  /** Annual price drift assumption applied over turnaround, e.g. -0.10. */
  annualPriceDrift?: number;
  /** Self-assessed condition, 1..5 (5 = pack fresh). Shifts the distribution. */
  conditionSelfRating?: number;
}

export interface EVBreakdownLine { label: string; amountUsd: number; note?: string }

export interface EVResult {
  verdict: Verdict;
  grader: GraderId;
  tier: GradingTier;
  distribution: GradeDistribution;
  expectedGradedValueUsd: number;
  rawValueUsd: number;
  totalCostUsd: number;
  /** Expected profit from grading vs selling raw. Positive => grading favored. */
  expectedProfitUsd: number;
  /** Probability grading loses money vs raw. */
  probabilityOfLoss: number;
  /** Grade needed to break even, if any. */
  breakEvenGrade?: Grade;
  breakdown: EVBreakdownLine[];
  caps: CenteringCap[];
  reasons: string[]; // plain-English bullet points for the verdict
  assumptions: string[];
  confidence: "low" | "medium" | "high";
}

/** A logged, timestamped prediction (the public "Receipts" log). */
export interface Prediction {
  id: string; // short public id, e.g. "R-0042"
  createdAt: string; // ISO
  card: CardRef;
  grader: GraderId;
  tierId: string;
  verdict: Verdict;
  distribution: GradeDistribution;
  expectedProfitUsd: number;
  intendsToSubmit: boolean;
  isPublic: boolean;
  outcome?: {
    certNumber?: string;
    grade: Grade;
    reportedAt: string;
  };
}

/** Saved locally in the browser (IndexedDB). */
export interface CollectionItem {
  id: string;
  savedAt: string;
  card: CardRef;
  centering?: CenteringResult;
  lastResult?: EVResult;
  frontThumb?: string; // small data URL, stays on device
  notes?: string;
}

export interface WaitlistSignup {
  email: string;
  createdAt: string;
  source?: string; // e.g. "after-first-verdict", "landing", "ref:abc"
  consentMarketing: boolean;
}
