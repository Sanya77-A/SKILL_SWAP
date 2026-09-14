import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "SwapRequest", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    proposedSlots: [{ type: String }],
    acceptedSlot: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PROPOSED", "CONFIRMED", "COMPLETED"],
      default: "PROPOSED",
    },
  },
  { timestamps: true }
);

sessionSchema.index({ requestId: 1 });
sessionSchema.index({ teacherId: 1, studentId: 1 });
sessionSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
sessionSchema.index({ studentId: 1, status: 1, createdAt: -1 });

export default mongoose.model("Session", sessionSchema);
