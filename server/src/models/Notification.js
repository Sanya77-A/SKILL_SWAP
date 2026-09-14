import mongoose from "mongoose";

export const notificationTypes = ["proposal", "booking", "booking_reminder", "message", "review", "credits", "badge", "community", "session", "certificate", "system"];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: notificationTypes, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, default: "", trim: true, maxlength: 1000 },
    link: { type: String, default: "", maxlength: 500 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    dedupeKey: { type: String, default: null, maxlength: 240 },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });

export default mongoose.model("Notification", notificationSchema);
