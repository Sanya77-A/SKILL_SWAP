import mongoose from "mongoose";
const historySchema = new mongoose.Schema({ status: { type: String, required: true }, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, note: { type: String, trim: true, maxlength: 1000, default: "" }, at: { type: Date, default: Date.now } }, { _id: false });
const schema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  against: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: String, enum: ["no_show", "service_quality", "harassment", "misrepresentation", "payment", "safety", "other"], required: true },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  evidenceUrls: { type: [{ type: String, trim: true, maxlength: 500 }], validate: [(value) => value.length <= 8, "At most eight evidence links are supported"] },
  status: { type: String, enum: ["open", "under_review", "resolved_refund", "resolved_no_action", "dismissed"], default: "open" },
  previousBookingStatus: { type: String, enum: ["confirmed", "upcoming", "in_progress"], required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolution: { type: String, trim: true, maxlength: 2000, default: "" },
  resolvedAt: { type: Date, default: null },
  history: [historySchema],
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ openedBy: 1, createdAt: -1 });
schema.index({ against: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: 1 });
export default mongoose.model("Dispute", schema);
