import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createSafetyReport } from "../services/safetyService.js";

/**
 * POST /api/reports — report a user
 */
export const createReport = asyncHandler(async (req, res) => {
  const { reportedUserId, reason } = req.body;
  if (reportedUserId === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: "Cannot report yourself" });
  }
  const data = await createSafetyReport(req.user._id, { targetType: "user", targetId: reportedUserId, category: "other", reason, evidenceUrls: [] });
  res.status(201).json({ success: true, data, message: "Report submitted" });
});
