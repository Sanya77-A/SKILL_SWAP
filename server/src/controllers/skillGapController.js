import SkillGapAnalysis from "../models/SkillGapAnalysis.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { analyzeSkillGap, getOwnedAnalysis } from "../services/skillGapService.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";

export const analyze = asyncHandler(async (req, res) => {
  const data = await analyzeSkillGap(req.user._id, req.body.careerPathId);
  res.status(201).json({ success: true, data });
});

export const history = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id, ...(req.query.careerPathId && { careerPath: req.query.careerPathId }) };
  const [data, total] = await Promise.all([
    SkillGapAnalysis.find(filter).select("careerPath careerPathTitle careerPathVersion missingSkills weakSkills recommendedNextSkills narrativeProvider createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SkillGapAnalysis.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const detail = asyncHandler(async (req, res) => {
  const data = await getOwnedAnalysis(req.user._id, req.params.id);
  res.json({ success: true, data });
});
