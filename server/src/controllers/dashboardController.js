import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

/**
 * GET /api/dashboard/stats - current user's dashboard stats + charts data
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [totalSwaps, pending, accepted, completed, swapsByMonth, user] = await Promise.all([
    SwapRequest.countDocuments({ $or: [{ sender: userId }, { receiver: userId }] }),
    SwapRequest.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: "PENDING",
    }),
    SwapRequest.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: "ACCEPTED",
    }),
    SwapRequest.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: "COMPLETED",
    }),
    SwapRequest.aggregate([
      { $match: { $or: [{ sender: userId }, { receiver: userId }], status: "COMPLETED" } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    User.findById(userId).select("skillsOffered skillsWanted ratingAvg ratingCount").lean(),
  ]);

  res.json({
    success: true,
    stats: {
      totalSwaps,
      pending,
      accepted,
      completed,
      ratingAvg: user?.ratingAvg ?? 0,
      ratingCount: user?.ratingCount ?? 0,
    },
    swapsByMonth,
    skillsOffered: user?.skillsOffered?.length ?? 0,
    skillsWanted: user?.skillsWanted?.length ?? 0,
  });
});
