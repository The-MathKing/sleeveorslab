import { z } from "zod";

export const cardIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9.]{1,32}-[A-Za-z0-9.-]{1,16}$/, "Invalid card id");

const httpsImage = z
  .string()
  .max(500)
  .regex(/^https:\/\/[^\s]+$/, "Image must be an https URL (hot-link only)")
  .optional();

export const cardRefSchema = z.object({
  id: cardIdSchema,
  name: z.string().trim().min(1).max(120),
  setId: z.string().trim().min(1).max(40),
  setName: z.string().trim().min(1).max(120),
  number: z.string().trim().min(1).max(20),
  rarity: z.string().max(60).optional(),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "releaseDate must be yyyy-mm-dd").optional(),
  imageSmall: httpsImage,
  imageLarge: httpsImage,
  finish: z.enum(["holo", "reverse-holo", "non-holo", "full-art", "unknown"]).optional(),
});

export const graderSchema = z.enum(["PSA", "CGC"]);
export const verdictSchema = z.enum(["SLAB", "SLEEVE", "BORDERLINE"]);
export const gradeSchema = z.int().min(1).max(10);

const gradeKey = z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

export const distributionSchema = z
  .partialRecord(gradeKey, z.number().min(0).max(1))
  .refine((d) => Object.keys(d).length > 0, "distribution must not be empty")
  .refine((d) => {
    const sum = Object.values(d).reduce<number>((a, b) => a + (b ?? 0), 0);
    return Math.abs(sum - 1) <= 0.02;
  }, "distribution probabilities must sum to 1");

export const predictionCreateSchema = z.object({
  card: cardRefSchema,
  grader: graderSchema,
  tierId: z.string().trim().min(1).max(64),
  verdict: verdictSchema,
  distribution: distributionSchema,
  expectedProfitUsd: z.number().refine(Number.isFinite, "expectedProfitUsd must be finite"),
  intendsToSubmit: z.boolean(),
  isPublic: z.boolean(),
});

export const waitlistSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email("Invalid email")),
  source: z.string().trim().max(64).optional(),
  consentMarketing: z.boolean(),
});

export const outcomeSchema = z.object({
  grade: gradeSchema,
  certNumber: z.string().trim().regex(/^[A-Za-z0-9-]{1,24}$/, "Invalid cert number").optional(),
});
