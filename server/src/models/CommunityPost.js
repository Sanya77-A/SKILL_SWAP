import mongoose from "mongoose";

const communityPostSchema = new mongoose.Schema({
  community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["post", "question", "resource"], default: "post" },
  title: { type: String, trim: true, maxlength: 200, default: "" },
  content: { type: String, required: true, trim: true, maxlength: 8000 },
  resourceUrl: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["published", "removed"], default: "published" },
  commentCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

communityPostSchema.index({ community: 1, status: 1, createdAt: -1 });
communityPostSchema.index({ author: 1, createdAt: -1 });

export default mongoose.model("CommunityPost", communityPostSchema);
