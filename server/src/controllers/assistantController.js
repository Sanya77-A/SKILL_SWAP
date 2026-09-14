import AIInteraction from "../models/AIInteraction.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { askAssistant } from "../services/assistantService.js";

export const ask = asyncHandler(async (req, res) => {
  const data = await askAssistant(req.user._id, req.body);
  res.json({ success: true, data, response: data });
});

export const history = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [data, total] = await Promise.all([
    AIInteraction.find({ user: req.user._id }).select("intent provider status answer cardReferences latencyMs createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AIInteraction.countDocuments({ user: req.user._id }),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});
