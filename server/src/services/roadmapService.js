import { z } from "zod";
import CareerPath from "../models/CareerPath.js";
import Roadmap from "../models/Roadmap.js";
import Skill from "../models/Skill.js";
import SkillGapAnalysis from "../models/SkillGapAnalysis.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { serializePublicUser } from "../serializers/userSerializer.js";
import { ApiError } from "../utils/ApiError.js";
import { aiService } from "./ai/aiService.js";
import { findMentorsForRequirements } from "./skillGapService.js";
import { createActivity, hideActivity } from "./activityService.js";
import { blockedUserIds } from "./safetyService.js";

const generatedPlanSchema = z.object({
  milestones: z.array(z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1000).default(""),
    tasks: z.array(z.object({
      title: z.string().trim().min(2).max(200),
      description: z.string().trim().max(1000).default(""),
    })).min(1).max(8),
  })).min(2).max(8),
});

const fallbackBlueprint = (skillName) => ({ milestones: [
  { title: `Build ${skillName} foundations`, description: "Establish the core concepts and vocabulary.", tasks: [{ title: `Review the canonical foundations of ${skillName}`, description: "Capture concise notes and questions." }, { title: "Complete one guided fundamentals exercise", description: "Record the result and what needs more practice." }] },
  { title: `Practice ${skillName} with feedback`, description: "Turn understanding into repeatable skill.", tasks: [{ title: "Book or prepare a focused mentor session", description: "Bring a specific outcome and questions." }, { title: "Complete two deliberate-practice exercises", description: "Compare outcomes and apply feedback." }] },
  { title: `Apply ${skillName} in a project`, description: "Create evidence in a realistic context.", tasks: [{ title: "Define a small portfolio project", description: "Set a measurable scope and completion criteria." }, { title: "Build and document the project", description: "Capture decisions, trade-offs, and results." }] },
  { title: `Demonstrate ${skillName} proficiency`, description: "Validate the target outcome and plan the next level.", tasks: [{ title: "Request a mentor review", description: "Use concrete evidence and focused feedback questions." }, { title: "Reflect and update your SkillSwap proficiency", description: "Update actual state only when evidence supports it." }] },
] });

const dateAtFraction = (startDate, targetDate, fraction) => new Date(startDate.getTime() + (targetDate.getTime() - startDate.getTime()) * fraction);

async function generatedBlueprint(user, skill, goal, context) {
  const fallback = fallbackBlueprint(skill.name);
  if (aiService.provider === "disabled") return { blueprint: fallback, source: "deterministic", provider: "grounded_fallback" };
  try {
    const result = await aiService.generate({
      userInput: `Create a learning roadmap for ${skill.name}. Goal: ${goal}. Return JSON exactly as {"milestones":[{"title":"","description":"","tasks":[{"title":"","description":""}]}]}. Use 2-8 milestones and 1-8 concrete tasks per milestone. Do not include users, scores, dates, progress, or claimed achievements.`,
      intent: "recommend_roadmap",
      context: { user, skills: context.skills, skillGap: context.skillGap, roadmaps: [{ targetSkill: skill.name, goal }] },
      output: "json",
      maxOutputTokens: 1200,
    });
    const parsed = generatedPlanSchema.safeParse(result.data);
    if (parsed.success) return { blueprint: parsed.data, source: "ai_enriched", provider: result.provider };
  } catch {
    // Deterministic plan remains available when provider output is unavailable or invalid.
  }
  return { blueprint: fallback, source: "deterministic", provider: "grounded_fallback" };
}

function recalculateRoadmap(roadmap) {
  for (const milestone of roadmap.milestones) {
    const tasks = roadmap.tasks.filter((task) => task.milestone.toString() === milestone._id.toString());
    if (!tasks.length) continue;
    const completed = tasks.filter((task) => task.status === "completed").length;
    milestone.status = completed === tasks.length ? "completed" : completed > 0 ? "in_progress" : "pending";
    milestone.completedAt = milestone.status === "completed" ? (milestone.completedAt || new Date()) : null;
  }
  const milestonesWithoutTasks = roadmap.milestones.filter((milestone) => !roadmap.tasks.some((task) => task.milestone.toString() === milestone._id.toString()));
  const units = roadmap.tasks.length ? [...roadmap.tasks, ...milestonesWithoutTasks] : roadmap.milestones;
  const completed = units.filter((item) => item.status === "completed").length;
  roadmap.progress = units.length ? Math.round((completed / units.length) * 100) : 0;
  if (roadmap.status !== "archived") {
    if (roadmap.progress === 100) roadmap.status = "completed";
    else if (roadmap.status === "completed") roadmap.status = "active";
  }
  return roadmap;
}

async function enrichRoadmap(value, viewerId) {
  const plain = typeof value.toObject === "function" ? value.toObject() : value;
  const excluded = await blockedUserIds(viewerId || plain.user);
  const users = await User.find({ _id: { $in: plain.mentorRecommendations.map((item) => item.user), $nin: excluded }, role: { $in: ["user", "mentor"] }, isDeleted: false, isBlocked: false, status: "active", profileVisibility: { $ne: "private" } }).lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), serializePublicUser(user)]));
  return { ...plain, mentorRecommendations: plain.mentorRecommendations.map((item) => ({ ...item, mentor: usersById.get(item.user.toString()) || null })) };
}

async function ownedRoadmap(userId, roadmapId) {
  const roadmap = await Roadmap.findOne({ _id: roadmapId, user: userId }).populate("targetSkill", "name slug category status");
  if (!roadmap) throw new ApiError(404, "ROADMAP_NOT_FOUND", "Roadmap not found");
  return roadmap;
}

export async function generateRoadmap(userId, payload) {
  const [user, skill, actualSkills] = await Promise.all([
    User.findById(userId).lean(),
    Skill.findOne({ _id: payload.targetSkillId, status: "active" }).lean(),
    UserSkill.find({ user: userId }).populate("skill", "name category").lean(),
  ]);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Active target skill not found");

  let careerPath = null;
  if (payload.careerPathId) {
    careerPath = await CareerPath.findOne({ _id: payload.careerPathId, status: "active", "requiredSkills.skill": skill._id }).populate("requiredSkills.skill", "name").lean();
    if (!careerPath) throw new ApiError(400, "SKILL_NOT_IN_CAREER_PATH", "The target skill is not required by this active career path");
  }
  let sourceAnalysis = null;
  if (payload.sourceAnalysisId) {
    sourceAnalysis = await SkillGapAnalysis.findOne({ _id: payload.sourceAnalysisId, user: userId, ...(careerPath && { careerPath: careerPath._id }) }).lean();
    if (!sourceAnalysis) throw new ApiError(404, "SKILL_GAP_NOT_FOUND", "Owned skill-gap analysis not found");
  }

  const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
  const targetDate = payload.targetDate ? new Date(payload.targetDate) : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
  if (targetDate <= startDate) throw new ApiError(400, "INVALID_ROADMAP_DATES", "Target date must be after start date");
  const gap = sourceAnalysis ? {
    careerGoal: sourceAnalysis.careerPathTitle,
    missingSkills: sourceAnalysis.missingSkills,
    weakSkills: sourceAnalysis.weakSkills,
    recommendedNextSkills: sourceAnalysis.recommendedNextSkills,
  } : null;
  const generated = await generatedBlueprint(user, skill, payload.goal, { skills: actualSkills, skillGap: gap });
  const roadmap = new Roadmap({
    user: userId,
    targetSkill: skill._id,
    careerPath: careerPath?._id || null,
    sourceAnalysis: sourceAnalysis?._id || null,
    goal: payload.goal,
    milestones: generated.blueprint.milestones.map((item, index, all) => ({
      title: item.title,
      description: item.description,
      order: index + 1,
      targetDate: dateAtFraction(startDate, targetDate, (index + 1) / all.length),
    })),
    startDate,
    targetDate,
    generationSource: generated.source,
    generationProvider: generated.provider,
  });
  roadmap.tasks = generated.blueprint.milestones.flatMap((item, milestoneIndex) => item.tasks.map((task, taskIndex) => ({
    milestone: roadmap.milestones[milestoneIndex]._id,
    title: task.title,
    description: task.description,
    order: taskIndex + 1,
  })));

  const requirement = { skill: { _id: skill._id, name: skill.name }, minimumProficiency: "Beginner" };
  const mentors = await findMentorsForRequirements(userId, [requirement]);
  roadmap.mentorRecommendations = mentors.map(({ publicUser, ...item }) => item);
  recalculateRoadmap(roadmap);
  await roadmap.save();
  await roadmap.populate("targetSkill", "name slug category status");
  return enrichRoadmap(roadmap, userId);
}

export async function getRoadmap(userId, roadmapId) {
  return enrichRoadmap(await ownedRoadmap(userId, roadmapId), userId);
}

export async function updateRoadmap(userId, roadmapId, payload) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  Object.assign(roadmap, payload);
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}

export async function addMilestone(userId, roadmapId, payload) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  if (roadmap.milestones.length >= 20) throw new ApiError(400, "MILESTONE_LIMIT", "A roadmap supports at most 20 milestones");
  roadmap.milestones.push({ ...payload, order: payload.order ?? Math.max(0, ...roadmap.milestones.map((item) => item.order)) + 1 });
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}

export async function updateMilestone(userId, roadmapId, milestoneId, payload) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  const milestone = roadmap.milestones.id(milestoneId);
  if (!milestone) throw new ApiError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
  Object.assign(milestone, payload);
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}

export async function completeMilestone(userId, roadmapId, milestoneId, completed) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  const milestone = roadmap.milestones.id(milestoneId);
  if (!milestone) throw new ApiError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
  const status = completed ? "completed" : "pending";
  milestone.status = status;
  milestone.completedAt = completed ? new Date() : null;
  roadmap.tasks.filter((task) => task.milestone.toString() === milestoneId).forEach((task) => {
    task.status = status;
    task.completedAt = completed ? new Date() : null;
  });
  recalculateRoadmap(roadmap);
  await roadmap.save();
  const eventKey = `roadmap:${roadmap._id}:milestone:${milestone._id}:completed`;
  if (completed) await createActivity({ actor: userId, type: "skill_milestone", title: `Completed ${milestone.title}`, body: `A learning milestone in ${roadmap.targetSkill.name}.`, link: "/roadmaps", skill: roadmap.targetSkill._id, entityType: "roadmap_milestone", entityId: milestone._id, visibility: "members", metadata: { roadmapId: roadmap._id }, dedupeKey: eventKey }).catch(() => {});
  else await hideActivity(eventKey).catch(() => {});
  return enrichRoadmap(roadmap);
}

export async function removeMilestone(userId, roadmapId, milestoneId) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  if (roadmap.milestones.length <= 1) throw new ApiError(400, "MILESTONE_REQUIRED", "A roadmap must retain at least one milestone");
  const milestone = roadmap.milestones.id(milestoneId);
  if (!milestone) throw new ApiError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
  milestone.deleteOne();
  roadmap.tasks = roadmap.tasks.filter((task) => task.milestone.toString() !== milestoneId);
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}

export async function addTask(userId, roadmapId, payload) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  if (!roadmap.milestones.id(payload.milestoneId)) throw new ApiError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
  if (roadmap.tasks.length >= 100) throw new ApiError(400, "TASK_LIMIT", "A roadmap supports at most 100 tasks");
  const siblings = roadmap.tasks.filter((item) => item.milestone.toString() === payload.milestoneId);
  roadmap.tasks.push({ ...payload, milestone: payload.milestoneId, order: payload.order ?? Math.max(0, ...siblings.map((item) => item.order)) + 1 });
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}

export async function updateTask(userId, roadmapId, taskId, payload) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  const task = roadmap.tasks.id(taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Roadmap task not found");
  if (payload.milestoneId && !roadmap.milestones.id(payload.milestoneId)) throw new ApiError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
  const { milestoneId, completed, ...changes } = payload;
  if (milestoneId) task.milestone = milestoneId;
  Object.assign(task, changes);
  if (completed !== undefined) {
    task.status = completed ? "completed" : "pending";
    task.completedAt = completed ? new Date() : null;
  }
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}

export async function removeTask(userId, roadmapId, taskId) {
  const roadmap = await ownedRoadmap(userId, roadmapId);
  const task = roadmap.tasks.id(taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Roadmap task not found");
  task.deleteOne();
  recalculateRoadmap(roadmap);
  await roadmap.save();
  return enrichRoadmap(roadmap);
}
