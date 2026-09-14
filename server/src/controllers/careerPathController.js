import CareerPath from "../models/CareerPath.js";
import Skill from "../models/Skill.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";

const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function canonicalRequirements(requiredSkills) {
  const skills = await Skill.find({ _id: { $in: requiredSkills.map((item) => item.skillId) }, status: "active" }).select("_id").lean();
  if (skills.length !== requiredSkills.length) throw new ApiError(400, "INVALID_REQUIRED_SKILLS", "Every required skill must reference an active canonical skill");
  return requiredSkills.map(({ skillId, ...item }) => ({ ...item, skill: skillId }));
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status: req.query.status };
  const [data, total] = await Promise.all([
    CareerPath.find(filter).populate("requiredSkills.skill", "name slug category status").sort({ title: 1 }).skip(skip).limit(limit).lean(),
    CareerPath.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const create = asyncHandler(async (req, res) => {
  const requiredSkills = await canonicalRequirements(req.body.requiredSkills);
  try {
    const data = await CareerPath.create({
      ...req.body,
      slug: req.body.slug || toSlug(req.body.title),
      requiredSkills,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await data.populate("requiredSkills.skill", "name slug category status");
    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "CAREER_PATH_EXISTS", "A career path with this slug already exists");
    throw error;
  }
});

export const update = asyncHandler(async (req, res) => {
  const data = await CareerPath.findById(req.params.id);
  if (!data) throw new ApiError(404, "CAREER_PATH_NOT_FOUND", "Career path not found");
  const payload = { ...req.body };
  if (payload.requiredSkills) payload.requiredSkills = await canonicalRequirements(payload.requiredSkills);
  if (payload.title && !payload.slug) payload.slug = toSlug(payload.title);
  Object.assign(data, payload, { updatedBy: req.user._id, version: data.version + 1 });
  try { await data.save(); }
  catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "CAREER_PATH_EXISTS", "A career path with this slug already exists");
    throw error;
  }
  await data.populate("requiredSkills.skill", "name slug category status");
  res.json({ success: true, data });
});
