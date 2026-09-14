import mongoose from "mongoose";

const matchCacheSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    matchedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    matchScore: { type: Number, required: true },
    reasons: [{ type: String }],
    factors: { type: mongoose.Schema.Types.Mixed, default: {} },
    strengths: [{ type: String }],
    conflicts: [{ type: String }],
  },
  { timestamps: true }
);

matchCacheSchema.index({ userId: 1, matchedUserId: 1 }, { unique: true });
matchCacheSchema.index({ userId: 1, matchScore: -1 });
matchCacheSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("MatchCache", matchCacheSchema);
