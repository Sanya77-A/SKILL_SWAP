import Roadmap from "../models/Roadmap.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import {
  addMilestone,
  addTask,
  completeMilestone,
  generateRoadmap,
  getRoadmap,
  removeMilestone,
  removeTask,
  updateMilestone,
  updateRoadmap,
  updateTask,
} from "../services/roadmapService.js";

export const generate = asyncHandler(async (req, res) => {
  const data = await generateRoadmap(req.user._id, req.body);
  res.status(201).json({ success: true, data });
});
export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id, ...(req.query.status && { status: req.query.status }) };
  const [data, total] = await Promise.all([
    Roadmap.find(filter).populate("targetSkill", "name slug category status").sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Roadmap.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});
export const detail = asyncHandler(async (req, res) => res.json({ success: true, data: await getRoadmap(req.user._id, req.params.id) }));
export const update = asyncHandler(async (req, res) => res.json({ success: true, data: await updateRoadmap(req.user._id, req.params.id, req.body) }));
export const createMilestone = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await addMilestone(req.user._id, req.params.id, req.body) }));
export const editMilestone = asyncHandler(async (req, res) => res.json({ success: true, data: await updateMilestone(req.user._id, req.params.id, req.params.milestoneId, req.body) }));
export const setMilestoneComplete = asyncHandler(async (req, res) => res.json({ success: true, data: await completeMilestone(req.user._id, req.params.id, req.params.milestoneId, req.body.completed) }));
export const deleteMilestone = asyncHandler(async (req, res) => res.json({ success: true, data: await removeMilestone(req.user._id, req.params.id, req.params.milestoneId) }));
export const createTask = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await addTask(req.user._id, req.params.id, req.body) }));
export const editTask = asyncHandler(async (req, res) => res.json({ success: true, data: await updateTask(req.user._id, req.params.id, req.params.taskId, req.body) }));
export const deleteTask = asyncHandler(async (req, res) => res.json({ success: true, data: await removeTask(req.user._id, req.params.id, req.params.taskId) }));
