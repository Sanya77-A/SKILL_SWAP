import mongoose from "mongoose";

const aiInteractionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestHash: { type: String, required: true, immutable: true },
    intent: { type: String, required: true },
    provider: { type: String, required: true },
    model: { type: String, default: "" },
    responseId: { type: String, default: "" },
    status: { type: String, enum: ["generated", "grounded_fallback", "failed"], required: true },
    answer: { type: String, required: true, maxlength: 10_000 },
    cardReferences: [{ kind: String, id: mongoose.Schema.Types.ObjectId, _id: false }],
    latencyMs: { type: Number, required: true, min: 0 },
    errorCode: { type: String, default: "" },
  },
  { timestamps: true }
);

aiInteractionSchema.index({ user: 1, createdAt: -1 });
aiInteractionSchema.index({ provider: 1, status: 1, createdAt: -1 });

export default mongoose.model("AIInteraction", aiInteractionSchema);
