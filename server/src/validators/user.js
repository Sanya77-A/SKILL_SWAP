import { z } from "zod";
import { httpUrl, idParams, page, limit, optionalHttpUrl, requestSchema } from "./common.js";

const parseJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
};
const stringArray = (item, max) => z.preprocess(parseJson, z.array(item).max(max));

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    fullName: z.string().min(2).max(100).optional(),
    username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
    profilePhoto: optionalHttpUrl.optional(),
    coverImage: optionalHttpUrl.optional(),
    bio: z.string().max(1000).optional(),
    headline: z.string().max(160).optional(),
    occupation: z.string().max(120).optional(),
    company: z.string().max(120).optional(),
    university: z.string().max(160).optional(),
    location: z.string().max(200).optional(),
    timezone: z.string().min(1).max(100).optional(),
    languages: stringArray(z.string().trim().min(1).max(80), 20).optional(),
    website: optionalHttpUrl.optional(),
    github: optionalHttpUrl.optional(),
    linkedin: optionalHttpUrl.optional(),
    portfolioLinks: z.preprocess(parseJson, z.array(z.object({
      label: z.string().trim().max(80),
      url: httpUrl,
    })).max(20)).optional(),
    availability: stringArray(z.string().trim().min(1).max(100), 30).optional(),
    visibility: z.enum(["public", "members", "private"]).optional(),
    profileVisibility: z.enum(["public", "members", "private"]).optional(),
    locationVisibility: z.enum(["public", "members", "private"]).optional(),
    showOnlineStatus: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
    showLastActive: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
    messagePermissions: z.enum(["everyone", "matches", "no_one"]).optional(),
    preferredLearningMode: z.enum(["online", "in_person", "hybrid"]).optional(),
    preferredTeachingMode: z.enum(["online", "in_person", "hybrid"]).optional(),
    preferredLearningModes: z.array(z.enum(["online", "in_person", "hybrid"])).max(3).optional(),
    preferredTeachingModes: z.array(z.enum(["online", "in_person", "hybrid"])).max(3).optional(),
    preferredExchangeModels: stringArray(z.enum(["exchange", "credits", "paid"]), 3).optional(),
    maxCreditCost: z.preprocess((value) => value === "" || value == null ? null : Number(value), z.number().min(0).nullable()).optional(),
    maxSessionPrice: z.preprocess((value) => value === "" || value == null ? null : Number(value), z.number().min(0).nullable()).optional(),
    preferredCurrency: z.string().trim().toUpperCase().length(3).optional(),
    learningGoals: stringArray(z.string().trim().min(1).max(300), 20).optional(),
    onboardingCompleted: z.boolean().optional(),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
    skillsOffered: z.union([z.array(z.string().trim()), z.string()]).optional(),
    skillsWanted: z.union([z.array(z.string().trim()), z.string()]).optional(),
  }).passthrough(),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listUsersSchema = requestSchema({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
    availability: z.string().trim().max(100).optional(),
    ratingMin: z.coerce.number().min(0).max(5).optional(),
    ratingMax: z.coerce.number().min(0).max(5).optional(),
    sort: z.enum(["ratingAvg", "ratingCount", "lastActiveAt", "createdAt", "name"]).default("ratingAvg"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page,
    limit,
  }).refine((value) => value.ratingMin == null || value.ratingMax == null || value.ratingMin <= value.ratingMax, {
    message: "Minimum rating cannot exceed maximum rating",
    path: ["ratingMin"],
  }),
});

export const userIdSchema = requestSchema({ params: idParams() });
export const deleteAccountSchema = requestSchema({ body: z.object({ currentPassword: z.string().min(8).max(128), confirmation: z.literal("DELETE") }) });

export const userReviewsSchema = requestSchema({
  params: idParams(),
  query: z.object({ page, limit }),
});

export const usernameSchema = requestSchema({
  params: z.object({
    username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_]+$/),
  }),
});
