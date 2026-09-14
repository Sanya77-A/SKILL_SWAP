import Review from "../models/Review.js";
import User from "../models/User.js";

const rounded = (value) => Math.round((value || 0) * 100) / 100;

export async function recalculateReputation(userId) {
  const [summary] = await Review.aggregate([
    { $match: { $or: [{ reviewee: userId }, { recipient: userId }], moderationStatus: { $ne: "hidden" } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        communication: { $avg: { $ifNull: ["$ratings.communication", "$rating"] } },
        knowledge: { $avg: { $ifNull: ["$ratings.knowledge", "$rating"] } },
        teaching: { $avg: { $ifNull: ["$ratings.teaching", "$rating"] } },
        punctuality: { $avg: { $ifNull: ["$ratings.punctuality", "$rating"] } },
        professionalism: { $avg: { $ifNull: ["$ratings.professionalism", "$rating"] } },
        overall: { $avg: { $ifNull: ["$ratings.overall", "$rating"] } },
        wouldLearnAgainCount: { $sum: { $cond: ["$wouldLearnAgain", 1, 0] } },
      },
    },
  ]);
  const count = summary?.count || 0;
  const reputation = {
    communication: rounded(summary?.communication),
    knowledge: rounded(summary?.knowledge),
    teaching: rounded(summary?.teaching),
    punctuality: rounded(summary?.punctuality),
    professionalism: rounded(summary?.professionalism),
    overall: rounded(summary?.overall),
    wouldLearnAgainRate: count ? Math.round((summary.wouldLearnAgainCount / count) * 100) : 0,
    updatedAt: new Date(),
  };
  await User.findByIdAndUpdate(userId, { ratingAvg: reputation.overall, ratingCount: count, reputation });
  return { ...reputation, ratingCount: count };
}
