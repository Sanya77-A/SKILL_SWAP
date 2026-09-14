import mongoose from "mongoose";
const schema = new mongoose.Schema({ activity: { type: mongoose.Schema.Types.ObjectId, ref: "Activity", required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
schema.index({ activity: 1, user: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1 });
export default mongoose.model("ActivitySave", schema);
