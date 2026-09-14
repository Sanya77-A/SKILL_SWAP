import { z } from "zod";
import { limit, objectId, page, requestSchema } from "./common.js";

const date = z.coerce.date();
const roadmapParams = z.object({ id: objectId });
const nestedParams = (key) => z.object({ id: objectId, [key]: objectId });

export const generateRoadmapSchema = requestSchema({
  body: z.object({
    targetSkillId: objectId,
    goal: z.string().trim().min(10).max(1000),
    careerPathId: objectId.optional(),
    sourceAnalysisId: objectId.optional(),
    startDate: date.optional(),
    targetDate: date.optional(),
  }),
});
export const listRoadmapsSchema = requestSchema({ query: z.object({
  status: z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
  page,
  limit,
}) });
export const roadmapIdSchema = requestSchema({ params: roadmapParams });
export const updateRoadmapSchema = requestSchema({
  params: roadmapParams,
  body: z.object({
    goal: z.string().trim().min(10).max(1000).optional(),
    startDate: date.optional(),
    targetDate: date.optional(),
    status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  }).refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
const milestoneFields = {
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).default(""),
  order: z.coerce.number().int().min(0).max(1000).optional(),
  targetDate: date.nullable().optional(),
};
export const addMilestoneSchema = requestSchema({ params: roadmapParams, body: z.object(milestoneFields) });
export const updateMilestoneSchema = requestSchema({
  params: nestedParams("milestoneId"),
  body: z.object(milestoneFields).partial().refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const completeMilestoneSchema = requestSchema({ params: nestedParams("milestoneId"), body: z.object({ completed: z.boolean() }) });
export const milestoneIdSchema = requestSchema({ params: nestedParams("milestoneId") });
const taskFields = {
  milestoneId: objectId,
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).default(""),
  order: z.coerce.number().int().min(0).max(1000).optional(),
};
export const addTaskSchema = requestSchema({ params: roadmapParams, body: z.object(taskFields) });
export const updateTaskSchema = requestSchema({
  params: nestedParams("taskId"),
  body: z.object({
    milestoneId: objectId.optional(),
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    order: z.coerce.number().int().min(0).max(1000).optional(),
    completed: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const taskIdSchema = requestSchema({ params: nestedParams("taskId") });
