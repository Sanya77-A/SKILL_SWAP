import Project from "../models/Project.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createProject, transitionProject, updateProject } from "../services/projectService.js";

export const mine = asyncHandler(async (req, res) => res.json({ success: true, data: await Project.find({ owner: req.user._id, status: { $ne: "archived" } }).populate("skills", "name slug category icon status").sort({ featured: -1, updatedAt: -1 }).lean() }));
export const create = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await createProject(req.user._id, req.body) }));
export const update = asyncHandler(async (req, res) => res.json({ success: true, data: await updateProject(req.user._id, req.params.id, req.body) }));
export const publish = asyncHandler(async (req, res) => res.json({ success: true, data: await transitionProject(req.user._id, req.params.id, "publish") }));
export const archive = asyncHandler(async (req, res) => res.json({ success: true, data: await transitionProject(req.user._id, req.params.id, "archive") }));
