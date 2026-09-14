import { z } from "zod";
import { limit, objectId, optionalHttpUrl, page, requestSchema } from "./common.js";

const task = z.object({ day: z.coerce.number().int().min(1).max(365), title: z.string().trim().min(2).max(180), description: z.string().trim().min(5).max(1500), evidenceRequired: z.boolean().default(false), xp: z.coerce.number().int().min(5).max(1000) });
export const createChallengeSchema = requestSchema({ body: z.object({
  title: z.string().trim().min(3).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).optional(), skillId: objectId, description: z.string().trim().min(10).max(4000), durationDays: z.coerce.number().int().min(2).max(365), dailyTasks: z.array(task).min(2).max(365), completionBonusXp: z.coerce.number().int().min(0).max(10000).default(0), rewardCredits: z.coerce.number().int().min(0).max(100000).default(0), badge: z.object({ key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), title: z.string().trim().min(2).max(120), description: z.string().trim().max(500).default(""), icon: z.string().trim().max(100).default("") }), enrollmentOpensAt: z.coerce.date().nullable().optional(), enrollmentClosesAt: z.coerce.date().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.dailyTasks.length !== value.durationDays) ctx.addIssue({ code: "custom", path: ["dailyTasks"], message: "Provide exactly one task per challenge day" });
  const totalDailyXp = value.dailyTasks.reduce((sum, item) => sum + item.xp, 0);
  if (value.completionBonusXp > totalDailyXp) ctx.addIssue({ code: "custom", path: ["completionBonusXp"], message: "Completion bonus cannot exceed earned daily XP" });
  if (value.rewardCredits > value.durationDays * 10) ctx.addIssue({ code: "custom", path: ["rewardCredits"], message: "Credit reward cannot exceed 10 credits per challenge day" });
}) });
export const listChallengesSchema = requestSchema({ query: z.object({ skillId: objectId.optional(), status: z.enum(["draft", "published", "ended", "archived"]).optional(), mine: z.coerce.boolean().optional(), page, limit }) });
export const challengeIdSchema = requestSchema({ params: z.object({ id: objectId }) });
export const challengeDaySchema = requestSchema({ params: z.object({ id: objectId, day: z.coerce.number().int().min(1).max(365) }), body: z.object({ evidenceUrl: optionalHttpUrl.default(""), note: z.string().trim().max(2000).default("") }) });
