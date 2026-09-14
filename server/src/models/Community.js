import mongoose from "mongoose";

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
  category: { type: String, trim: true, maxlength: 100, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  rules: [{ type: String, trim: true, maxlength: 500 }],
  status: { type: String, enum: ["active", "archived"], default: "active" },
  memberCount: { type: Number, min: 0, default: 1 },
  postCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

communitySchema.index({ status: 1, visibility: 1, memberCount: -1 });
communitySchema.index({ skill: 1, status: 1 });
communitySchema.index({ name: "text", description: "text", category: "text" });

export default mongoose.model("Community", communitySchema);
