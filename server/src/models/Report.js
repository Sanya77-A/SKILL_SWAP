import mongoose from "mongoose";
import crypto from "crypto";

const reportSchema = new mongoose.Schema(
  {
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["user", "listing", "message", "review"], required: true, default: "user" },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    category: { type: String, enum: ["spam", "harassment", "scam", "inappropriate", "safety", "privacy", "other"], default: "other" },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    evidenceUrls: [{ type: String, trim: true, maxlength: 500 }],
    status: { type: String, enum: ["submitted", "triaged", "in_review", "resolved", "dismissed"], default: "submitted" },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolution: { type: String, trim: true, maxlength: 2000, default: "" },
    resolvedAt: { type: Date, default: null },
    fingerprint: { type: String, required: true, unique: true, immutable: true, maxlength: 64 },
    history: [{ status: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, note: { type: String, maxlength: 1000, default: "" }, at: { type: Date, default: Date.now }, _id: false }],
  },
  { timestamps: true }
);

reportSchema.index({ reportedUserId: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1, priority: -1, createdAt: 1 });
reportSchema.pre("validate", function (next) {
  this.reporter = this.reporter || this.reportedBy;
  this.reportedBy = this.reportedBy || this.reporter;
  this.targetId = this.targetId || this.reportedUserId;
  if (this.targetType === "user") this.reportedUserId = this.reportedUserId || this.targetId;
  if (!this.fingerprint && this.reporter && this.targetId) this.fingerprint = crypto.createHash("sha256").update(`${this.reporter}:${this.targetType}:${this.targetId}`).digest("hex");
  next();
});

export default mongoose.model("Report", reportSchema);
