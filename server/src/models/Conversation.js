import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    participantKey: { type: String, unique: true, sparse: true, select: false },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    unreadCount: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.pre("validate", function (next) {
  if (this.participants?.length === 2) {
    this.participantKey = this.participants.map((value) => value.toString()).sort().join(":");
  }
  next();
});

export default mongoose.model("Conversation", conversationSchema);
