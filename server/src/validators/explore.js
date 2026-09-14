import { z } from "zod";
import { limit, page, requestSchema } from "./common.js";

const bool = z.enum(["true", "false"]).transform((value) => value === "true");

export const exploreSearchSchema = requestSchema({
  query: z.object({
    q: z.string().trim().max(100).default(""),
    category: z.string().trim().max(100).optional(),
    skillId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    ratingMin: z.coerce.number().min(0).max(5).optional(),
    proficiency: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
    priceMin: z.coerce.number().min(0).optional(),
    priceMax: z.coerce.number().min(0).optional(),
    creditMax: z.coerce.number().int().min(0).optional(),
    deliveryMode: z.enum(["online", "in_person"]).optional(),
    language: z.string().trim().max(80).optional(),
    location: z.string().trim().max(200).optional(),
    availability: z.string().trim().max(100).optional(),
    verification: bool.optional(),
    mentorExperience: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert", "all_levels"]).optional(),
    exchangeOnly: bool.optional(),
    creditsOnly: bool.optional(),
    paidOnly: bool.optional(),
    sort: z.enum(["best_match", "highest_rated", "most_experienced", "lowest_price", "most_active", "newest"]).default("best_match"),
    page,
    limit,
  }).refine((value) => value.priceMin == null || value.priceMax == null || value.priceMin <= value.priceMax, {
    message: "Minimum price cannot exceed maximum price", path: ["priceMin"],
  }),
});
