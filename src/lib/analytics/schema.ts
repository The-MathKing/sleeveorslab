// Server-side validation for POST /api/events: a closed allowlist of events and props.
import { z } from "zod";
import { PHOTO_METHODS } from "./types";

const none = z.object({}).strict().optional();
const token = (max: number) => z.string().min(1).max(max).regex(/^[a-z0-9][a-z0-9._:-]*$/, "invalid token");

const base = { visitId: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "invalid visit id") };

export const eventSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("page_view"),
      ...base,
      props: z
        .object({
          path: z.string().max(120).regex(/^\/[A-Za-z0-9/_.-]*$/, "invalid path"),
          ref: token(64).optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ name: z.literal("scan_started"), ...base, props: none }).strict(),
  z
    .object({ name: z.literal("photo_captured"), ...base, props: z.object({ method: z.enum(PHOTO_METHODS) }).strict() })
    .strict(),
  z.object({ name: z.literal("camera_unavailable"), ...base, props: none }).strict(),
  z.object({ name: z.literal("centering_done"), ...base, props: none }).strict(),
  z.object({ name: z.literal("card_selected"), ...base, props: none }).strict(),
  z
    .object({
      name: z.literal("verdict_shown"),
      ...base,
      props: z.object({ verdict: z.enum(["SLAB", "SLEEVE", "BORDERLINE"]), grader: z.enum(["PSA", "CGC"]) }).strict(),
    })
    .strict(),
  z
    .object({ name: z.literal("waitlist_signup"), ...base, props: z.object({ source: token(40) }).strict() })
    .strict(),
  z.object({ name: z.literal("prediction_logged"), ...base, props: none }).strict(),
  z.object({ name: z.literal("share_clicked"), ...base, props: none }).strict(),
  z.object({ name: z.literal("qr_shown"), ...base, props: none }).strict(),
  z
    .object({
      name: z.literal("binder_evaluated"),
      ...base,
      props: z.object({ cards: z.int().min(0).max(1000) }).strict(),
    })
    .strict(),
]);

export type EventBody = z.infer<typeof eventSchema>;
