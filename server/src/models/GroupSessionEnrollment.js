import mongoose from "mongoose";

const schema = new mongoose.Schema({
  groupSession: { type: mongoose.Schema.Types.ObjectId, ref: "GroupSession", required: true },
  participant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "enrolled", "cancelled", "attended", "no_show"], default: "pending" },
  creditAmount: { type: Number, min: 0, default: 0 },
  paymentAmount: { type: Number, min: 0, default: 0 },
  enrolledAt: { type: Date, default: Date.now },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ groupSession: 1, participant: 1 }, { unique: true });
schema.index({ participant: 1, status: 1, createdAt: -1 });
export default mongoose.model("GroupSessionEnrollment", schema);
