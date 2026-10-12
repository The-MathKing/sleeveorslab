// Gem-rate priors. We have NO pop-report data, so these are coarse, documented
// heuristics by era x finish class — never per-card numbers. Every basis string
// says "estimate" so the UI can label it.
import type { CardRef, Era, GraderId } from "@/lib/types";
import { eraOf } from "./era";

export type FinishClass = "full-art" | "holo" | "non-holo" | "unknown";

/**
 * P(PSA 10) among submitted copies with no visible defects (submitters pre-screen,
 * so this is higher than "any copy pulled from a pack"). Conservative estimates.
 * Reasoning: textured full-art / SIR cards show surface + edge wear easily; older
 * eras have weaker print quality and more handling.
 */
export const PSA_GEM_PRIOR: Record<Era, Record<FinishClass, number>> = {
  modern: { "non-holo": 0.55, holo: 0.45, "full-art": 0.35, unknown: 0.4 },
  "sword-shield": { "non-holo": 0.5, holo: 0.4, "full-art": 0.3, unknown: 0.35 },
  "sun-moon": { "non-holo": 0.4, holo: 0.3, "full-art": 0.22, unknown: 0.28 },
  xy: { "non-holo": 0.3, holo: 0.22, "full-art": 0.15, unknown: 0.2 },
  older: { "non-holo": 0.12, holo: 0.08, "full-art": 0.06, unknown: 0.08 },
};

/** CGC 10 (Gem Mint or Pristine) is harder than PSA 10: modelled as a fixed fraction. */
export const CGC_GEM_FACTOR = 0.45;

const FULL_ART_RE = /(special illustration|illustration rare|hyper rare|secret|full art|rainbow|gold|ultra rare|trainer gallery|shiny ultra|character (super )?rare)/i;
const HOLO_RE = /(holo|double rare|\bex\b|\bgx\b|\bv\b|vmax|vstar|ace spec|radiant|amazing|shiny|prism|break|legend|star)/i;
const NON_HOLO_RE = /^(common|uncommon|rare)$/i;

export function finishClassOf(card: Pick<CardRef, "finish" | "rarity">): FinishClass {
  const r = (card.rarity ?? "").trim();
  if (card.finish === "full-art" || FULL_ART_RE.test(r)) return "full-art";
  if (card.finish === "holo" || HOLO_RE.test(r)) return "holo";
  if (card.finish === "non-holo" || card.finish === "reverse-holo" || NON_HOLO_RE.test(r)) return "non-holo";
  return "unknown";
}

const ERA_LABEL: Record<Era, string> = {
  modern: "modern (Scarlet & Violet)",
  "sword-shield": "Sword & Shield",
  "sun-moon": "Sun & Moon",
  xy: "XY",
  older: "pre-2014",
};
const FINISH_LABEL: Record<FinishClass, string> = {
  "full-art": "full-art",
  holo: "holo",
  "non-holo": "non-holo",
  unknown: "unknown-finish",
};

export function gemRatePrior(card: CardRef, grader: GraderId): { pGem: number; basis: string } {
  const era = eraOf(card);
  const fc = finishClassOf(card);
  const psa = PSA_GEM_PRIOR[era][fc];
  const pGem = grader === "PSA" ? psa : Math.round(psa * CGC_GEM_FACTOR * 1000) / 1000;
  const label = grader === "PSA" ? "PSA 10" : "CGC 10";
  const basis =
    `Era/finish prior (estimate): ${ERA_LABEL[era]} ${FINISH_LABEL[fc]} ≈ ${Math.round(pGem * 100)}% ${label} ` +
    `among submitted copies. Not pop-report data.`;
  return { pGem, basis };
}
