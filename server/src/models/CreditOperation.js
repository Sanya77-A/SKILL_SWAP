import mongoose from "mongoose";
import { creditTransactionTypes } from "./CreditTransaction.js";

const creditOperationSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true, immutable: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    amount: { type: Number, required: true, immutable: true },
    type: { type: String, enum: creditTransactionTypes, required: true, immutable: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "CreditTransaction", default: null },
    errorCode: { type: String, default: "" },
  },
  { timestamps: true }
);

creditOperationSchema.index({ status: 1, updatedAt: 1 });

export default mongoose.model("CreditOperation", creditOperationSchema);
