import mongoose from "mongoose";
import { notificationTypes } from "./Notification.js";

const typeSettings = Object.fromEntries(notificationTypes.map((type) => [type, { type: Boolean, default: true }]));

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, immutable: true },
    inApp: { type: new mongoose.Schema(typeSettings, { _id: false }), default: () => ({}) },
    emailDigest: { type: String, enum: ["off", "daily", "weekly"], default: "off" },
    pushEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("NotificationPreference", notificationPreferenceSchema);
