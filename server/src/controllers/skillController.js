import Skill from "../models/Skill.js";
import UserSkill from "../models/UserSkill.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { escapeRegex } from "../utils/search.js";

const toSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const listSkills = asyncHandler(async (req, res) => {
  const { q, category, status = "active", sort = "popularityScore", order = "desc" } = req.query;
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status };

  if (category) filter.category = category;
  if (q) {
    const safeQuery = escapeRegex(q);
    filter.$or = [
      { name: { $regex: safeQuery, $options: "i" } },
      { aliases: { $regex: safeQuery, $options: "i" } },
      { tags: { $regex: safeQuery, $options: "i" } },
      { description: { $regex: safeQuery, $options: "i" } },
    ];
  }

  const sortDirection = order === "asc" ? 1 : -1;
  const [data, total] = await Promise.all([
    Skill.find(filter).sort({ [sort]: sortDirection }).skip(skip).limit(limit).lean(),
    Skill.countDocuments(filter),
  ]);

  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const getSkill = asyncHandler(async (req, res) => {
  const key = req.params.identifier;
  const filter = /^[0-9a-fA-F]{24}$/.test(key) ? { _id: key } : { slug: key.toLowerCase() };
  const skill = await Skill.findOne(filter).lean();
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found");
  res.json({ success: true, data: skill, skill });
});

export const createSkill = asyncHandler(async (req, res) => {
  const payload = { ...req.body, slug: req.body.slug || toSlug(req.body.name) };
  try {
    const skill = await Skill.create(payload);
    res.status(201).json({ success: true, data: skill, skill });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "SKILL_EXISTS", "A skill with that name or slug already exists");
    }
    throw error;
  }
});

export const updateSkill = asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found");
  Object.assign(skill, req.body);
  if (req.body.name && !req.body.slug) skill.slug = toSlug(req.body.name);
  try {
    await skill.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "SKILL_EXISTS", "A skill with that name or slug already exists");
    }
    throw error;
  }
  res.json({ success: true, data: skill, skill });
});

export const archiveSkill = asyncHandler(async (req, res) => {
  const activeUsage = await UserSkill.countDocuments({ skill: req.params.id });
  const skill = await Skill.findByIdAndUpdate(
    req.params.id,
    { status: "archived" },
    { new: true, runValidators: true }
  );
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found");
  res.json({
    success: true,
    data: skill,
    skill,
    message: activeUsage ? `Skill archived; ${activeUsage} user associations were preserved` : "Skill archived",
  });
});
