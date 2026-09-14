import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getExploreSections, searchMarketplace } from "../services/exploreService.js";

export const sections = asyncHandler(async (req, res) => {
  const data = await getExploreSections(req.user?._id);
  res.json({ success: true, data });
});

export const search = asyncHandler(async (req, res) => {
  const data = await searchMarketplace(req.query, req.user?._id);
  res.json({ success: true, data });
});
