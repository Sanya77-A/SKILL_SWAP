import mongoose from "mongoose";
const schema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, challenge: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true }, enrollment: { type: mongoose.Schema.Types.ObjectId, ref: "ChallengeEnrollment", required: true }, badgeKey: { type: String, required: true }, title: { type: String, required: true }, description: { type: String, default: "" }, icon: { type: String, default: "" }, grantedAt: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ user: 1, challenge: 1 }, { unique: true });
schema.index({ user: 1, grantedAt: -1 });
export default mongoose.model("ChallengeBadgeGrant", schema);
