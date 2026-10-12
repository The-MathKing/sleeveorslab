import type { CardRef, GradeDistribution, Prediction } from "@/lib/types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "r-42", "R-0042", "42" → "R-0042". Returns null when not an id. */
export function normalizePredictionId(id: string): string | null {
  const m = /^(?:r-)?(\d{1,9})$/i.exec(id.trim());
  if (!m) return null;
  return formatPredictionId(parseInt(m[1], 10));
}

export function formatPredictionId(seq: number): string {
  return `R-${String(seq).padStart(4, "0")}`;
}

export function parsePredictionSeq(id: string): number {
  const m = /^R-(\d+)$/.exec(id);
  return m ? parseInt(m[1], 10) : 0;
}

/** Copy only known CardRef fields, so nothing extra (e.g. photo data) is ever persisted. */
export function sanitizeCard(c: CardRef): CardRef {
  const out: CardRef = { id: c.id, name: c.name, setId: c.setId, setName: c.setName, number: c.number };
  if (c.rarity !== undefined) out.rarity = c.rarity;
  if (c.releaseDate !== undefined) out.releaseDate = c.releaseDate;
  // Hot-link URLs only; never data: URIs.
  if (c.imageSmall && /^https:\/\//.test(c.imageSmall)) out.imageSmall = c.imageSmall;
  if (c.imageLarge && /^https:\/\//.test(c.imageLarge)) out.imageLarge = c.imageLarge;
  if (c.finish !== undefined) out.finish = c.finish;
  return out;
}

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function sanitizeDistribution(d: GradeDistribution): GradeDistribution {
  const out: GradeDistribution = {};
  for (const g of GRADES) {
    const v = d[g];
    if (typeof v === "number" && Number.isFinite(v)) out[g] = v;
  }
  return out;
}

export function buildPrediction(
  p: Omit<Prediction, "id" | "createdAt">,
  id: string,
  createdAt: string,
): Prediction {
  return {
    id,
    createdAt,
    card: sanitizeCard(p.card),
    grader: p.grader,
    tierId: p.tierId,
    verdict: p.verdict,
    distribution: sanitizeDistribution(p.distribution),
    expectedProfitUsd: p.expectedProfitUsd,
    intendsToSubmit: p.intendsToSubmit,
    isPublic: p.isPublic,
  };
}
