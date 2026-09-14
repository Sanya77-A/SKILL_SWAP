import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clientMessageId: { type: String, trim: true, maxlength: 100, default: null },
    messageType: {
      type: String,
      enum: ["text", "image", "document", "booking", "skill", "proposal", "system"],
      default: "text",
    },
    content: { type: String, default: "" },
    attachments: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "document"], required: true },
        name: { type: String, default: "", maxlength: 255 },
        mimeType: { type: String, default: "", maxlength: 120 },
        size: { type: Number, min: 0, default: 0 },
        _id: false,
      },
    ],
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: "SwapProposal", default: null },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, read: 1, sender: 1 });
messageSchema.index(
  { sender: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: "string" } } }
);

export default mongoose.model("Message", messageSchema);
