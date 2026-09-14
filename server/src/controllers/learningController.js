import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getMyLearning } from "../services/learningService.js";

export const myLearning = asyncHandler(async (req, res) => {
  const data = await getMyLearning(req.user._id);
  res.json({ success: true, data });
});
