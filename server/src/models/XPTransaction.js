import mongoose from "mongoose";
const schema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true }, challenge: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true, immutable: true }, enrollment: { type: mongoose.Schema.Types.ObjectId, ref: "ChallengeEnrollment", required: true, immutable: true }, points: { type: Number, required: true, min: 1, immutable: true }, type: { type: String, enum: ["daily_completion", "completion_bonus"], required: true, immutable: true }, reason: { type: String, required: true, trim: true, maxlength: 300, immutable: true }, idempotencyKey: { type: String, required: true, unique: true, maxlength: 200, immutable: true } }, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ user: 1, createdAt: -1 });
const immutableLedger = (next) => next(new Error("XP transactions are immutable"));
schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"], immutableLedger);
export default mongoose.model("XPTransaction", schema);
