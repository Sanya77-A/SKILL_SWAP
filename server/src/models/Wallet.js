import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, immutable: true },
    balance: { type: Number, default: 0, min: 0 },
    lifetimeEarned: { type: Number, default: 0, min: 0 },
    lifetimeSpent: { type: Number, default: 0, min: 0 },
    revision: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

walletSchema.index({ updatedAt: -1 });

export default mongoose.model("Wallet", walletSchema);
