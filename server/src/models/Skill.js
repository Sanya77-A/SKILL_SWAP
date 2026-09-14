import mongoose from "mongoose";

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, default: "", maxlength: 2000 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    tags: [{ type: String, lowercase: true, trim: true, maxlength: 50 }],
    aliases: [{ type: String, lowercase: true, trim: true, maxlength: 100 }],
    status: { type: String, enum: ["active", "archived"], default: "active" },
    icon: { type: String, default: "", maxlength: 500 },
    popularityScore: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

skillSchema.index({ category: 1, status: 1, popularityScore: -1 });
skillSchema.index({ name: "text", description: "text", aliases: "text", tags: "text" });

export default mongoose.model("Skill", skillSchema);
