import { z } from "zod";
import { objectId, optionalHttpUrl, requestSchema } from "./common.js";

const optionalUrl = optionalHttpUrl.default("");
const fields = {
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(3000),
  skillIds: z.array(objectId).min(1).max(10).refine((values) => new Set(values).size === values.length, "Project skills must be unique"),
  role: z.string().trim().max(120).default(""),
  projectUrl: optionalUrl,
  repositoryUrl: optionalUrl,
  imageUrl: optionalUrl,
  outcomes: z.array(z.string().trim().min(2).max(300)).max(8).default([]),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  featured: z.boolean().default(false),
};
const validateDates = (value, ctx) => { if (value.startedAt && value.completedAt && value.completedAt < value.startedAt) ctx.addIssue({ code: "custom", path: ["completedAt"], message: "Completion date cannot precede start date" }); };
export const createProjectSchema = requestSchema({ body: z.object(fields).superRefine(validateDates) });
export const updateProjectSchema = requestSchema({ params: z.object({ id: objectId }), body: z.object(fields).partial().superRefine(validateDates).refine((value) => Object.keys(value).length > 0, "Provide at least one field") });
export const projectIdSchema = requestSchema({ params: z.object({ id: objectId }) });
