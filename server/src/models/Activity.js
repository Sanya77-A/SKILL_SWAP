import mongoose from "mongoose";

export const activityTypes = ["certificate_earned", "challenge_completed", "listing_published", "skill_milestone", "community_post", "mentor_achievement", "group_session_announced"];
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: activityTypes, required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  body: { type: String, trim: true, maxlength: 1200, default: "" },
  link: { type: String, required: true, trim: true, maxlength: 500 },
  skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
  entityType: { type: String, enum: ["certificate", "challenge", "listing", "roadmap_milestone", "community_post", "achievement", "group_session"], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  visibility: { type: String, enum: ["public", "members"], default: "members" },
  status: { type: String, enum: ["active", "hidden"], default: "active" },
  likeCount: { type: Number, min: 0, default: 0 },
  commentCount: { type: Number, min: 0, default: 0 },
  saveCount: { type: Number, min: 0, default: 0 },
  dedupeKey: { type: String, required: true, unique: true, immutable: true, maxlength: 240 },
  occurredAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ status: 1, occurredAt: -1 });
schema.index({ actor: 1, status: 1, occurredAt: -1 });
schema.index({ type: 1, status: 1, occurredAt: -1 });
export default mongoose.model("Activity", schema);
