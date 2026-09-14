import mongoose from "mongoose";
const schema = new mongoose.Schema({
  blocker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  blocked: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true });
schema.index({ blocker: 1, blocked: 1 }, { unique: true });
schema.index({ blocked: 1, createdAt: -1 });
export default mongoose.model("UserBlock", schema);
