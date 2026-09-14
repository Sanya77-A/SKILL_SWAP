import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  order: { type: Number, min: 0, max: 1000, required: true },
  targetDate: { type: Date, default: null },
  status: { type: String, enum: ["pending", "in_progress", "completed"], default: "pending" },
  completedAt: { type: Date, default: null },
});

const taskSchema = new mongoose.Schema({
  milestone: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  order: { type: Number, min: 0, max: 1000, required: true },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  completedAt: { type: Date, default: null },
});

const mentorRecommendationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    skillName: { type: String, required: true },
    suitabilityScore: { type: Number, min: 0, max: 100, required: true },
    reasons: [{ type: String, maxlength: 180 }],
  },
  { _id: false }
);

const roadmapSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetSkill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    careerPath: { type: mongoose.Schema.Types.ObjectId, ref: "CareerPath", default: null },
    sourceAnalysis: { type: mongoose.Schema.Types.ObjectId, ref: "SkillGapAnalysis", default: null },
    goal: { type: String, required: true, trim: true, maxlength: 1000 },
    milestones: { type: [milestoneSchema], validate: [(value) => value.length > 0 && value.length <= 20, "A roadmap requires 1-20 milestones"] },
    tasks: { type: [taskSchema], validate: [(value) => value.length <= 100, "A roadmap supports at most 100 tasks"] },
    mentorRecommendations: [mentorRecommendationSchema],
    startDate: { type: Date, required: true },
    targetDate: { type: Date, required: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ["draft", "active", "paused", "completed", "archived"], default: "active" },
    generationSource: { type: String, enum: ["deterministic", "ai_enriched"], default: "deterministic" },
    generationProvider: { type: String, maxlength: 80, default: "grounded_fallback" },
  },
  { timestamps: true, optimisticConcurrency: true }
);

roadmapSchema.index({ user: 1, status: 1, updatedAt: -1 });
roadmapSchema.index({ user: 1, targetSkill: 1, createdAt: -1 });
roadmapSchema.pre("validate", function (next) {
  if (this.targetDate <= this.startDate) this.invalidate("targetDate", "Target date must be after start date");
  const milestoneIds = new Set(this.milestones.map((item) => item._id.toString()));
  if (this.tasks.some((task) => !milestoneIds.has(task.milestone.toString()))) this.invalidate("tasks", "Every task must belong to a roadmap milestone");
  next();
});

export default mongoose.model("Roadmap", roadmapSchema);
