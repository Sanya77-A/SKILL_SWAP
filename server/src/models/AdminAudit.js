import mongoose from "mongoose";

const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  actorRole: { type: String, enum: ["moderator", "admin", "super_admin"], required: true, immutable: true },
  action: { type: String, required: true, trim: true, maxlength: 100, immutable: true },
  targetType: { type: String, enum: ["user", "skill", "listing", "review", "community", "user_skill"], required: true, immutable: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  before: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  after: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  note: { type: String, trim: true, maxlength: 1000, default: "", immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ actor: 1, createdAt: -1 });
schema.index({ targetType: 1, targetId: 1, createdAt: -1 });
const immutable = (next) => next(new Error("Admin audit records are immutable"));
schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"], immutable);
export default mongoose.model("AdminAudit", schema);
