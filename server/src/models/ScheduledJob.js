import mongoose from "mongoose";

const scheduledJobSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, immutable: true },
    lockId: { type: String, default: "" },
    lockedUntil: { type: Date, default: () => new Date(0) },
    lastStartedAt: { type: Date, default: null },
    lastCompletedAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: "" },
  },
  { timestamps: true }
);

scheduledJobSchema.index({ lockedUntil: 1 });

export default mongoose.model("ScheduledJob", scheduledJobSchema);
