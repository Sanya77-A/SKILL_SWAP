import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, uppercase: true, trim: true, minlength: 3, maxlength: 3, required: true },
  },
  { _id: false }
);

const revisionSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    offeredSessions: Number,
    requestedSessions: Number,
    duration: Number,
    proposedSchedule: [scheduleSchema],
    deliveryMode: String,
    optionalCredits: Number,
    optionalPayment: paymentSchema,
    message: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const swapProposalSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", default: null },
    offeredSkill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    requestedSkill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    offeredSessions: { type: Number, min: 0, max: 100, default: 1 },
    requestedSessions: { type: Number, min: 1, max: 100, default: 1 },
    duration: { type: Number, min: 15, max: 240, required: true },
    proposedSchedule: [scheduleSchema],
    deliveryMode: { type: String, enum: ["video", "audio", "in_person"], required: true },
    message: { type: String, default: "", maxlength: 2000 },
    optionalCredits: { type: Number, min: 0, max: 1_000_000, default: 0 },
    optionalPayment: { type: paymentSchema, default: null },
    status: {
      type: String,
      enum: ["draft", "pending", "accepted", "countered", "declined", "cancelled", "expired", "completed"],
      default: "draft",
    },
    actionRequiredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    revisions: [revisionSchema],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    respondedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

swapProposalSchema.index({ requester: 1, status: 1, updatedAt: -1 });
swapProposalSchema.index({ recipient: 1, status: 1, updatedAt: -1 });
swapProposalSchema.index({ actionRequiredBy: 1, status: 1, expiresAt: 1 });
swapProposalSchema.index({ expiresAt: 1, status: 1 });

export default mongoose.model("SwapProposal", swapProposalSchema);
