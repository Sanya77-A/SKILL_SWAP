import mongoose from "mongoose";

const swapRequestSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skillToLearn: { type: String, required: true, trim: true },
    skillToTeach: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    proposedSchedule: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELED", "COMPLETED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

swapRequestSchema.index({ sender: 1, receiver: 1, status: 1 });
swapRequestSchema.index({ sender: 1, status: 1, createdAt: -1 });
swapRequestSchema.index({ receiver: 1, status: 1, createdAt: -1 });

export default mongoose.model("SwapRequest", swapRequestSchema);
