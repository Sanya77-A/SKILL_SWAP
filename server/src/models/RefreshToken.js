import mongoose from "mongoose";
import crypto from "crypto";

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, default: () => crypto.randomUUID(), index: true },
    revokedAt: { type: Date, default: null },
    rotatedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: "", select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1, expiresAt: -1 });

export default mongoose.model("RefreshToken", refreshTokenSchema);
