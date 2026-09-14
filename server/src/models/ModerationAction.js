import mongoose from "mongoose";
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  targetType: { type: String, enum: ["report", "dispute", "user", "listing", "message", "review"], required: true, immutable: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  action: { type: String, required: true, trim: true, maxlength: 100, immutable: true },
  previousStatus: { type: String, trim: true, maxlength: 80, default: "", immutable: true },
  nextStatus: { type: String, trim: true, maxlength: 80, default: "", immutable: true },
  note: { type: String, trim: true, maxlength: 2000, default: "", immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ targetType: 1, targetId: 1, createdAt: -1 });
schema.index({ actor: 1, createdAt: -1 });
export default mongoose.model("ModerationAction", schema);
