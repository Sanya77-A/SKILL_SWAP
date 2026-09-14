import { getMatches } from "../services/matchService.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

/**
 * GET /api/matches - recommended matches (paginated, filterable)
 */
export const getRecommendedMatches = asyncHandler(async (req, res) => {
  const { page, limit, experienceLevel, availability } = req.query;
  const availabilityArr = availability ? (Array.isArray(availability) ? availability : [availability]) : undefined;
  const result = await getMatches(req.user._id, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    experienceLevel,
    availability: availabilityArr,
  });
  res.json({ success: true, ...result });
});
