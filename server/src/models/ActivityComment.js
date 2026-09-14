import mongoose from "mongoose";
const schema = new mongoose.Schema({
  activity: { type: mongoose.Schema.Types.ObjectId, ref: "Activity", required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  body: { type: String, required: true, trim: true, maxlength: 1500 },
  status: { type: String, enum: ["active", "removed"], default: "active" },
  removedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ activity: 1, status: 1, createdAt: 1 });
schema.index({ author: 1, createdAt: -1 });
export default mongoose.model("ActivityComment", schema);
