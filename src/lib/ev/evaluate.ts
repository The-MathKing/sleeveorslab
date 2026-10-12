import type {
  EVBreakdownLine, EVInput, EVResult, Grade, GradeDistribution, GradingTier, Verdict,
} from "@/lib/types";
import { centeringCaps, eraOf, FEES_LAST_VERIFIED, getTier, getTiers, isSingleCardTier } from "@/lib/grading";
import { gradeDistribution, gemProbability, GRADES } from "./distribution";
import { buildPriceLadder, resolveRaw } from "./prices";

export const DEFAULT_SHIPPING_PER_CARD_USD = 6;
export const DEFAULT_SELLING_FEE_RATE = 0.13;
export const DEFAULT_ANNUAL_PRICE_DRIFT = -0.05;
export const BUSINESS_DAYS_PER_YEAR = 252;
/** SLAB needs expected profit above max(SLAB_MIN_PROFIT_USD, SLAB_MIN_PROFIT_COST_FRACTION × costs)… */
export const SLAB_MIN_PROFIT_USD = 10;
export const SLAB_MIN_PROFIT_COST_FRACTION = 0.15;
/** …and a probability of losing money below this. */
export const SLAB_MAX_LOSS_PROBABILITY = 0.5;

const cents = (v: number) => Math.round(v * 100) / 100 + 0; // +0 normalises -0
const pct = (p: number) => `${Math.round(p * 100)}%`;
function usd(v: number): string {
  const a = Math.abs(v);
  return a >= 10 || Number.isInteger(a) ? `$${Math.round(a)}` : `$${a.toFixed(2)}`;
}

function upchargeTier(tier: GradingTier, declared: number): { tier?: GradingTier; exceedsAll: boolean } {
  if (tier.maxDeclaredValueUsd === undefined || declared <= tier.maxDeclaredValueUsd) return { exceedsAll: false };
  const pool = getTiers(tier.grader).filter((t) => t.available && isSingleCardTier(t));
  const ok = pool.filter((t) => t.maxDeclaredValueUsd === undefined || t.maxDeclaredValueUsd >= declared)
    .sort((a, b) => a.feeUsd - b.feeUsd);
  if (ok.length) return { tier: ok[0], exceedsAll: false };
  const top = pool.sort((a, b) => (b.maxDeclaredValueUsd ?? Infinity) - (a.maxDeclaredValueUsd ?? Infinity))[0];
  return { tier: top, exceedsAll: true };
}

export function evaluate(input: EVInput): EVResult {
  const tier = getTier(input.tierId);
  if (!tier) throw new Error(`Unknown grading tier: ${input.tierId}`);
  if (tier.grader !== input.grader) throw new Error(`Tier ${input.tierId} belongs to ${tier.grader}, not ${input.grader}`);
  const grader = input.grader;
  const shipping = Math.max(0, input.shippingPerCardUsd ?? DEFAULT_SHIPPING_PER_CARD_USD);
  const feeRate = Math.min(0.9, Math.max(0, input.sellingFeeRate ?? DEFAULT_SELLING_FEE_RATE));
  const drift = input.annualPriceDrift ?? DEFAULT_ANNUAL_PRICE_DRIFT;
  const assumptions: string[] = [];

  // --- distribution ---
  const distArgs = {
    card: input.card, grader, centering: input.centering,
    gemRateOverride: input.gemRateOverride, conditionSelfRating: input.conditionSelfRating,
  };
  const distribution: GradeDistribution = gradeDistribution(distArgs);
  const gem = gemProbability(distArgs);
  const caps = centeringCaps(input.centering ?? {});
  const myCap = caps.find((c) => c.grader === grader)!;
  const P = (g: Grade) => distribution[g] ?? 0;

  // --- prices ---
  const rawR = resolveRaw(input.price);
  const raw = rawR.raw;
  const ladder = buildPriceLadder(input.price, grader, raw, eraOf(input.card));
  const ladderEstimated = input.price.gradedIsEstimate || ladder.source[10] !== "market" || ladder.source[9] !== "market";
  const pricesEstimated = rawR.estimated || ladderEstimated;

  // --- drift over turnaround midpoint ---
  const [d0, d1] = tier.turnaroundBusinessDays;
  const midDays = (d0 + d1) / 2;
  const driftFactor = Math.pow(1 + drift, midDays / BUSINESS_DAYS_PER_YEAR);
  const gross = (g: Grade) => ladder.value[g] * driftFactor;

  const expectedGross = GRADES.reduce((s, g) => s + P(g) * gross(g), 0);
  const declaredForCap = GRADES.reduce((s, g) => s + P(g) * ladder.value[g], 0);

  // --- costs ---
  let upcharge = 0;
  const up = upchargeTier(tier, declaredForCap);
  if (up.tier && up.tier.feeUsd > tier.feeUsd) {
    upcharge = up.tier.feeUsd - tier.feeUsd;
    assumptions.push(
      `Expected slab value ${usd(declaredForCap)} exceeds the ${tier.name} declared-value cap of ${usd(tier.maxDeclaredValueUsd ?? 0)}; ` +
      `priced as an upcharge to ${up.tier.name} (+${usd(upcharge)}).` +
      (up.exceedsAll ? " Value exceeds every listed cap; the grader may charge a percentage of value on top." : ""),
    );
  }

  // --- lines (rounded to cents; profit is their exact sum) ---
  const lines: EVBreakdownLine[] = [];
  const add = (label: string, amount: number, note?: string) => {
    const l: EVBreakdownLine = { label, amountUsd: cents(amount) };
    if (note) l.note = note;
    lines.push(l);
  };
  add("Expected graded sale value", expectedGross,
    `Probability-weighted ${grader} prices${drift !== 0 ? `, after ${pct(drift)}/yr price drift over ~${Math.round(midDays)} business days` : ""}${ladderEstimated ? " (estimate)" : ""}`);
  add("Selling fees on graded sale", -expectedGross * feeRate, `${pct(feeRate)} marketplace fees`);
  add(`Grading fee (${tier.name})`, -tier.feeUsd, `Fees last verified ${FEES_LAST_VERIFIED}`);
  add("Shipping & insurance", -shipping, "Per card, both directions");
  if (upcharge > 0) add("Declared-value upcharge", -upcharge, `Bumped to ${up.tier!.name}`);
  const netRaw = raw * (1 - feeRate);
  add("Instead: sell raw now (after fees)", -netRaw, rawR.estimated ? "Raw price estimated" : undefined);

  const expectedProfitUsd = cents(lines.reduce((s, l) => s + l.amountUsd, 0));
  const totalCostUsd = cents(tier.feeUsd + shipping + upcharge);
  const netSale = (g: Grade) => gross(g) * (1 - feeRate);

  let probabilityOfLoss = 0;
  for (const g of GRADES) if (netSale(g) - totalCostUsd < netRaw) probabilityOfLoss += P(g);
  probabilityOfLoss = Math.min(1, Math.max(0, probabilityOfLoss));
  const breakEvenGrade = GRADES.find((g) => netSale(g) > netRaw + totalCostUsd);

  // --- verdict ---
  const slabBar = Math.max(SLAB_MIN_PROFIT_USD, SLAB_MIN_PROFIT_COST_FRACTION * totalCostUsd);
  let verdict: Verdict;
  if (expectedProfitUsd > slabBar && probabilityOfLoss < SLAB_MAX_LOSS_PROBABILITY) verdict = "SLAB";
  else if (expectedProfitUsd < 0) verdict = "SLEEVE";
  else verdict = "BORDERLINE";

  const hasCentering = !!input.centering?.front;
  const confidence: EVResult["confidence"] =
    !pricesEstimated && hasCentering ? "high" : !pricesEstimated || hasCentering ? "medium" : "low";

  // --- reasons (brand voice) ---
  const reasons: string[] = [];
  const pAtLeast = (g: Grade) => GRADES.filter((x) => x >= g).reduce((s, x) => s + P(x), 0);
  if (verdict === "SLEEVE") {
    if (totalCostUsd >= raw) reasons.push(`Fees eat ${usd(totalCostUsd)} of a ${usd(raw)} card. Sleeve it.`);
    else reasons.push(`Grading loses ~${usd(-expectedProfitUsd)} on average vs selling raw. Sleeve it.`);
  } else if (verdict === "SLAB") {
    reasons.push(`Expected +${usd(expectedProfitUsd)} over selling raw, with a ${pct(probabilityOfLoss)} chance of losing money. Slab it.`);
  } else if (expectedProfitUsd > slabBar) {
    reasons.push(`Expected +${usd(expectedProfitUsd)} on paper, but a ${pct(probabilityOfLoss)} chance of losing money. It's a bet, not a sure thing.`);
  } else {
    reasons.push(`Thin margin: expected ${expectedProfitUsd >= 0 ? "+" : "-"}${usd(expectedProfitUsd)} with a ${pct(probabilityOfLoss)} chance of losing money. Your call.`);
  }
  if (breakEvenGrade === undefined) reasons.push(`No grade pays — even a ${grader} 10 loses money vs selling raw.`);
  else if (breakEvenGrade === 10) reasons.push(`Only a 10 pays, and there's ~${pct(P(10))} chance of one.`);
  else reasons.push(`You need a ${grader} ${breakEvenGrade} or better to come out ahead (~${pct(pAtLeast(breakEvenGrade))} chance).`);
  if (input.centering && myCap.maxGrade < 10) reasons.push(`${myCap.label}. That kills the 10.`);
  else if (!hasCentering) reasons.push("Centering not measured — the 10 odds are a guess until you scan it.");
  if (upcharge > 0) reasons.push(`A high-value slab likely bumps you to ${up.tier!.name} (+${usd(upcharge)}).`);
  if (reasons.length < 4 && pricesEstimated) reasons.push("Graded prices are estimates — treat the dollar figures as rough.");

  // --- assumptions ---
  assumptions.unshift(
    gem.basis,
    `Grade distribution is an estimate: P(10) ${pct(P(10))}, P(9) ${pct(P(9))}, P(8 or lower) ${pct(1 - P(10) - P(9))}.`,
    `${tier.name}: $${tier.feeUsd.toFixed(2)}/card, ~${d0}–${d1} business days (fees last verified ${FEES_LAST_VERIFIED}).`,
    `Shipping & insurance ${usd(shipping)} per card round trip; selling fees ${pct(feeRate)}.`,
    `Price drift ${pct(drift)}/yr applied over the turnaround midpoint.`,
  );
  if (rawR.missing) assumptions.push("No raw or graded price found; values are zero. Enter a price to get a real answer.");
  else if (rawR.estimated) assumptions.push(`Raw price missing; estimated as 40% of the median known graded price (${usd(raw)}).`);
  const estGrades = GRADES.filter((g) => ladder.source[g] !== "market" && g >= 7);
  if (input.price.gradedIsEstimate) assumptions.push("gradedIsEstimate: graded prices are heuristic estimates, not sales data.");
  else if (estGrades.length) {
    assumptions.push(`gradedIsEstimate: no market data for ${grader} ${estGrades.join(", ")}; filled by interpolation or raw-price multiples (estimate).`);
  }
  if (input.conditionSelfRating !== undefined && input.conditionSelfRating !== 3) {
    assumptions.push(`Your condition rating (${input.conditionSelfRating}/5) shifted the grade odds.`);
  }
  if (!hasCentering) assumptions.push("Centering not measured; no centering cap applied.");
  else assumptions.push(myCap.label + ".");
  if ((tier.minCards ?? 1) > 1) assumptions.push(`${tier.name} has a ${tier.minCards}-card minimum — only works if you're sending a batch.`);
  if (!tier.available) assumptions.push(`${tier.name} is currently paused by ${grader}.`);
  if (tier.notes) assumptions.push(`${tier.name}: ${tier.notes}.`);

  return {
    verdict, grader, tier, distribution,
    expectedGradedValueUsd: cents(expectedGross),
    rawValueUsd: cents(raw),
    totalCostUsd,
    expectedProfitUsd,
    probabilityOfLoss,
    ...(breakEvenGrade !== undefined ? { breakEvenGrade } : {}),
    breakdown: lines,
    caps,
    reasons: reasons.slice(0, 4),
    assumptions,
    confidence,
  };
}

/** Evaluate every available PSA and CGC tier; best = highest expected profit. */
export function evaluateAllGraders(input: Omit<EVInput, "grader" | "tierId">): { best: EVResult; all: EVResult[] } {
  const all = getTiers().filter((t) => t.available).map((t) => evaluate({ ...input, grader: t.grader, tierId: t.id }));
  const best = all.reduce((a, b) => (b.expectedProfitUsd > a.expectedProfitUsd ? b : a));
  return { best, all };
}
