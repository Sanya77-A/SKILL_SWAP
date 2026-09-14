import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  skills: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }], validate: [(value) => value.length >= 1 && value.length <= 10, "Projects require 1-10 skills"] },
  role: { type: String, trim: true, maxlength: 120, default: "" },
  projectUrl: { type: String, trim: true, maxlength: 500, default: "" },
  repositoryUrl: { type: String, trim: true, maxlength: 500, default: "" },
  imageUrl: { type: String, trim: true, maxlength: 500, default: "" },
  outcomes: { type: [{ type: String, trim: true, maxlength: 300 }], validate: [(value) => value.length <= 8, "Projects support at most eight outcomes"] },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
}, { timestamps: true, optimisticConcurrency: true });
projectSchema.index({ owner: 1, status: 1, featured: -1, updatedAt: -1 });
projectSchema.index({ skills: 1, status: 1 });
projectSchema.pre("validate", function (next) {
  if (this.startedAt && this.completedAt && this.completedAt < this.startedAt) this.invalidate("completedAt", "Completion date cannot precede start date");
  if (new Set(this.skills.map(String)).size !== this.skills.length) this.invalidate("skills", "Project skills must be unique");
  next();
});
export default mongoose.model("Project", projectSchema);
