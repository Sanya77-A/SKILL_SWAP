import mongoose from "mongoose";

const communityMembershipSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["admin", "moderator", "member"], default: "member" },
  status: { type: String, enum: ["active", "left", "banned"], default: "active" },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

communityMembershipSchema.index({ community: 1, user: 1 }, { unique: true });
communityMembershipSchema.index({ user: 1, status: 1, updatedAt: -1 });

export default mongoose.model("CommunityMembership", communityMembershipSchema);
