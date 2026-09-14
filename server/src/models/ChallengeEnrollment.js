import mongoose from "mongoose";
const schema = new mongoose.Schema({
  challenge: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
  startedAt: { type: Date, default: Date.now },
  targetEndAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  progressDays: { type: Number, min: 0, default: 0 },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  currentStreak: { type: Number, min: 0, default: 0 },
  longestStreak: { type: Number, min: 0, default: 0 },
  xp: { type: Number, min: 0, default: 0 },
  rewardGranted: { type: Boolean, default: false },
  badgeGranted: { type: Boolean, default: false },
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ challenge: 1, user: 1 }, { unique: true });
schema.index({ user: 1, status: 1, updatedAt: -1 });
export default mongoose.model("ChallengeEnrollment", schema);
