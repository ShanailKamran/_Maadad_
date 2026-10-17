import { z } from "zod";
import { AppError } from "./state";

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
const text = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required.` })
    .transform(clean)
    .pipe(z.string().min(min, `${label} must be at least ${min} characters.`).max(max, `${label} must be at most ${max} characters.`));

const optionalInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .pipe(z.number().int("Enter whole rupees.").positive().max(10_000_000).nullable());

/** Digit run of 7+ (allowing separators) looks like a phone number; keep these out of public text. */
export const looksLikePhone = (s: string) => /(\+?\d[\s\-().]?){7,}/.test(s);
const publicText = (min: number, max: number, label: string) =>
  text(min, max, label).refine((v) => !looksLikePhone(v), {
    message: `${label}: please don't include phone numbers here. Contact details are shared only with the worker you choose.`,
  });

// Lahore bounding box (generous). Pins outside are rejected, not silently accepted.
export const LAHORE_BBOX = { minLat: 31.2, maxLat: 31.75, minLng: 74.1, maxLng: 74.65 };

export const jobSchema = z
  .object({
    categoryId: z.coerce.number().int().positive("Choose a category."),
    areaId: z.coerce.number().int().positive("Choose your area."),
    title: publicText(5, 120, "Title"),
    description: publicText(20, 2000, "Description"),
    budgetMin: optionalInt,
    budgetMax: optionalInt,
    asap: z.coerce.boolean().default(false),
    preferredAt: z.string().optional().default(""),
    addressText: text(5, 300, "Address / location details"),
    contactNote: z.string().transform(clean).pipe(z.string().max(300)).optional().default(""),
    lat: z.string().optional().default(""),
    lng: z.string().optional().default(""),
    ack: z.literal("on", { errorMap: () => ({ message: "Please confirm you understand how payment works." }) }),
  })
  .superRefine((v, ctx) => {
    if (v.budgetMin && v.budgetMax && v.budgetMax < v.budgetMin)
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Maximum budget must be at least the minimum." });
    if (!v.asap && !v.preferredAt)
      ctx.addIssue({ code: "custom", path: ["preferredAt"], message: "Pick a preferred time or choose 'as soon as possible'." });
    if (v.lat || v.lng) {
      const la = Number(v.lat), ln = Number(v.lng);
      if (!isFinite(la) || !isFinite(ln) || la < LAHORE_BBOX.minLat || la > LAHORE_BBOX.maxLat || ln < LAHORE_BBOX.minLng || ln > LAHORE_BBOX.maxLng)
        ctx.addIssue({ code: "custom", path: ["lat"], message: "That location is outside Lahore. Clear the pin and use the address field." });
    }
  });

export const bidSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Enter your price in whole rupees." }).int("Enter whole rupees.").min(100, "Minimum bid is Rs 100.").max(10_000_000),
  timingText: text(3, 120, "Arrival / completion window"),
  message: text(5, 800, "Message"),
  inclusions: z.string().transform(clean).pipe(z.string().max(500)).optional().default(""),
  exclusions: z.string().transform(clean).pipe(z.string().max(500)).optional().default(""),
});

export const reviewSchema = z.object({
  stars: z.coerce.number().int().min(1, "Choose a star rating.").max(5),
  comment: z.string().transform(clean).pipe(z.string().max(1000)).optional().default(""),
});

export const reportSchema = z.object({
  targetType: z.enum(["user", "job", "bid", "review", "booking"]),
  targetId: z.string().uuid(),
  category: z.enum(["spam","no_show","harassment","suspected_fraud","unsafe_conduct","misleading_price","inappropriate_content","other"]),
  details: z.string().transform(clean).pipe(z.string().max(1500)).optional().default(""),
});

export const workerProfileSchema = z.object({
  displayName: text(2, 60, "Display name"),
  bio: text(20, 800, "About you"),
  experienceYears: z.coerce.number().int().min(0).max(60),
  categoryIds: z.array(z.coerce.number().int().positive()).min(1, "Choose at least one service."),
  areaIds: z.array(z.coerce.number().int().positive()).min(1, "Choose at least one service area."),
  acceptingBids: z.coerce.boolean().default(false),
});

/** Convert a zod failure to a single friendly AppError. */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(r.error.issues.map((i) => i.message)[0]);
  return r.data;
}
