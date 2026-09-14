import mongoose from "mongoose";

const communityCommentSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost", required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ["published", "removed"], default: "published" },
}, { timestamps: true });

communityCommentSchema.index({ post: 1, status: 1, createdAt: 1 });

export default mongoose.model("CommunityComment", communityCommentSchema);
