import { z } from "zod";
import { httpUrl, idParams, limit, page, requestSchema } from "./common.js";

const slug = z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const url = httpUrl;

const skillFields = {
  name: z.string().trim().min(2).max(100),
  slug: slug.optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(2).max(100),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  aliases: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  status: z.enum(["active", "archived"]).optional(),
  icon: z.union([url, z.literal("")]).optional(),
  popularityScore: z.number().min(0).optional(),
};

export const listSkillsSchema = requestSchema({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    status: z.enum(["active", "archived"]).default("active"),
    sort: z.enum(["popularityScore", "name", "createdAt", "updatedAt"]).default("popularityScore"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page,
    limit,
  }),
});

export const skillIdentifierSchema = requestSchema({
  params: z.object({ identifier: z.string().trim().min(2).max(120) }),
});

export const createSkillSchema = requestSchema({ body: z.object(skillFields) });
export const updateSkillSchema = requestSchema({
  params: idParams(),
  body: z.object(skillFields).partial().refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const skillIdSchema = requestSchema({ params: idParams() });

const userSkillFields = {
  type: z.enum(["teach", "learn", "both"]),
  proficiency: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).default("Beginner"),
  yearsExperience: z.coerce.number().min(0).max(80).default(0),
  description: z.string().trim().max(2000).default(""),
  evidence: z.array(z.object({
    type: z.enum(["link", "certificate", "portfolio", "other"]).default("link"),
    label: z.string().trim().max(120).default(""),
    url,
  })).max(20).default([]),
};

export const createUserSkillSchema = requestSchema({
  body: z.object({ skillId: z.string().regex(/^[0-9a-fA-F]{24}$/), ...userSkillFields }),
});
export const updateUserSkillSchema = requestSchema({
  params: idParams(),
  body: z.object(userSkillFields).partial().refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const userSkillIdSchema = requestSchema({ params: idParams() });
