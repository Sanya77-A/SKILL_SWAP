import { z } from "zod";
import { idParams, limit, objectId, page, requestSchema } from "./common.js";

const slug = z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const requiredSkill = z.object({
  skillId: objectId,
  minimumProficiency: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).default("Beginner"),
  importance: z.enum(["core", "supporting"]).default("core"),
  rationale: z.string().trim().max(500).default(""),
  order: z.coerce.number().int().min(0).max(1000).default(0),
});
const uniqueRequiredSkills = (items) => new Set(items.map((item) => item.skillId)).size === items.length;
const careerPathFields = {
  title: z.string().trim().min(2).max(120),
  slug: slug.optional(),
  description: z.string().trim().max(2000).default(""),
  requiredSkills: z.array(requiredSkill).min(1).max(50).refine(uniqueRequiredSkills, "A skill may appear only once"),
  status: z.enum(["active", "archived"]).default("active"),
};

export const listCareerPathsSchema = requestSchema({
  query: z.object({ status: z.enum(["active", "archived"]).default("active"), page, limit }),
});
export const createCareerPathSchema = requestSchema({ body: z.object(careerPathFields) });
export const updateCareerPathSchema = requestSchema({
  params: idParams(),
  body: z.object(careerPathFields).partial().refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const analyzeSkillGapSchema = requestSchema({ body: z.object({ careerPathId: objectId }) });
export const skillGapHistorySchema = requestSchema({ query: z.object({ page, limit, careerPathId: objectId.optional() }) });
export const skillGapIdSchema = requestSchema({ params: idParams() });
