import mongoose from "mongoose";
const schema = new mongoose.Schema({
  enrollment: { type: mongoose.Schema.Types.ObjectId, ref: "ChallengeEnrollment", required: true }, challenge: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, day: { type: Number, required: true, min: 1, max: 365 }, taskTitle: { type: String, required: true }, evidenceUrl: { type: String, trim: true, maxlength: 500, default: "" }, note: { type: String, trim: true, maxlength: 2000, default: "" }, activityDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, xpAwarded: { type: Number, required: true, min: 1 }, completedAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ enrollment: 1, day: 1 }, { unique: true });
schema.index({ enrollment: 1, activityDay: 1 }, { unique: true });
schema.index({ user: 1, completedAt: -1 });
export default mongoose.model("ChallengeDayCompletion", schema);
