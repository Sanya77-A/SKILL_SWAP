import mongoose from "mongoose";

import { env } from "../config/env.js";
import Review from "../models/Review.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

async function migrateReviewIndexes() {
  const name = "author_1_swapRequest_1";
  const indexes = await Review.collection.indexes();
  const current = indexes.find((index) => index.name === name);
  if (current && !current.partialFilterExpression) {
    await Review.collection.dropIndex(name);
  }
  await Review.collection.createIndex(
    { author: 1, swapRequest: 1 },
    {
      name,
      unique: true,
      partialFilterExpression: { swapRequest: { $type: "objectId" } },
    }
  );
}

async function run() {
  await mongoose.connect(env.MONGO_URI);
  await migrateReviewIndexes();
  const conversationIndexes = await Conversation.collection.indexes();
  const staleParticipants = conversationIndexes.find((item) => item.name === "participants_1" && item.unique);
  if (staleParticipants) await Conversation.collection.dropIndex(staleParticipants.name);
  await Conversation.collection.createIndex({ participants: 1, lastMessageAt: -1 }, { name: "participants_1_lastMessageAt_-1" });
  await Message.collection.createIndex(
    { sender: 1, clientMessageId: 1 },
    { name: "sender_1_clientMessageId_1", unique: true, partialFilterExpression: { clientMessageId: { $type: "string" } } }
  );
  const index = (await Review.collection.indexes()).find((item) => item.name === "author_1_swapRequest_1");
  const messageIndex = (await Message.collection.indexes()).find((item) => item.name === "sender_1_clientMessageId_1");
  process.stdout.write(`${JSON.stringify({ success: true, reviewIndex: index, messageIndex, removedStaleConversationIndex: Boolean(staleParticipants) })}\n`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
