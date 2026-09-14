import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  type: { type: String, enum: ["profile_view", "listing_view"], required: true },
  entityType: { type: String, enum: ["profile", "listing"], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  activityDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  eventKey: { type: String, required: true, unique: true, immutable: true, maxlength: 64 },
  occurredAt: { type: Date, default: Date.now, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
analyticsEventSchema.index({ subject: 1, type: 1, occurredAt: -1 });
analyticsEventSchema.index({ subject: 1, activityDay: 1 });
export default mongoose.model("AnalyticsEvent", analyticsEventSchema);
