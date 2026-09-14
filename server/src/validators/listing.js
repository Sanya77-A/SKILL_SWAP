import { z } from "zod";
import { idParams, limit, page, requestSchema } from "./common.js";

const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");

const listingFields = {
  skillId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  title: z.string().trim().min(8).max(140),
  description: z.string().trim().min(30).max(5000),
  learningOutcomes: z.array(z.string().trim().min(3).max(300)).min(1).max(20),
  prerequisites: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert", "all_levels"]).default("all_levels"),
  deliveryMode: z.array(z.enum(["video", "audio", "in_person"])).min(1).max(3),
  sessionDurations: z.array(z.number().int().min(15).max(240)).min(1).max(8)
    .refine((values) => values.every((value) => value % 15 === 0), "Durations must use 15-minute increments"),
  exchangeEnabled: z.boolean().default(true),
  creditsEnabled: z.boolean().default(false),
  paidEnabled: z.boolean().default(false),
  creditCost: z.number().int().min(0).max(1_000_000).default(0),
  price: z.number().min(0).max(1_000_000).multipleOf(0.01).default(0),
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  capacity: z.number().int().min(1).max(100).default(1),
};

export const createListingSchema = requestSchema({ body: z.object(listingFields) });
export const updateListingSchema = requestSchema({
  params: idParams(),
  body: z.object(listingFields).partial().refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const listingIdSchema = requestSchema({ params: idParams() });
export const listListingsSchema = requestSchema({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    skillId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    deliveryMode: z.enum(["video", "audio", "in_person"]).optional(),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert", "all_levels"]).optional(),
    exchangeEnabled: booleanQuery.optional(),
    creditsEnabled: booleanQuery.optional(),
    paidEnabled: booleanQuery.optional(),
    sort: z.enum(["newest", "rating", "price_low", "popular"]).default("newest"),
    page,
    limit,
  }),
});
