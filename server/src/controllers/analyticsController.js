import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import Message from "../models/Message.js";
import { getMentorAnalytics } from "../services/analyticsService.js";

export const getMentor = asyncHandler(async (req, res) => res.json({ success: true, data: await getMentorAnalytics(req.user._id, req.query.rangeDays) }));

/**
 * GET /api/analytics/user — current user analytics
 */
export const getUserAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [totalSwaps, pendingSwaps, completedSwaps, user] = await Promise.all([
    SwapRequest.countDocuments({ $or: [{ sender: userId }, { receiver: userId }] }),
    SwapRequest.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: "PENDING",
    }),
    SwapRequest.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: "COMPLETED",
    }),
    User.findById(userId).select("ratingAvg ratingCount").lean(),
  ]);
  res.json({
    success: true,
    totalSwaps,
    pendingSwaps,
    completedSwaps,
    ratingAverage: user?.ratingAvg ?? 0,
    ratingCount: user?.ratingCount ?? 0,
  });
});

/**
 * GET /api/analytics/platform — admin only
 */
export const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalUsers, activeUsers, totalRequests, totalMessages] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isDeleted: false, isBlocked: false, updatedAt: { $gte: sevenDaysAgo } }),
    SwapRequest.countDocuments(),
    Message.countDocuments(),
  ]);
  res.json({
    success: true,
    totalUsers,
    activeUsers,
    totalRequests,
    totalMessages,
  });
});
