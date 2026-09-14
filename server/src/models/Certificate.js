import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, required: true, unique: true, uppercase: true, trim: true, immutable: true },
    learner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true, immutable: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
    achievement: { type: String, required: true, trim: true, maxlength: 300, immutable: true },
    sourceType: { type: String, enum: ["challenge", "roadmap", "roadmap_milestone", "legacy"], default: "legacy", immutable: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    sourceMilestoneId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    sourceKey: { type: String, default: null, maxlength: 240, immutable: true },
    evidenceSnapshot: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    issuedAt: { type: Date, required: true, default: Date.now, immutable: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
    verificationCode: { type: String, required: true, unique: true, trim: true, immutable: true },
    integrityHash: { type: String, default: "", maxlength: 64, immutable: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    revocationReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

certificateSchema.index({ learner: 1, issuedAt: -1 });
certificateSchema.index({ skill: 1, status: 1 });
certificateSchema.index({ sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string" } } });

export default mongoose.model("Certificate", certificateSchema);
