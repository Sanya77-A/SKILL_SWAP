import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createNotification } from "../services/notificationService.js";
import { emitToConversation, emitToUser } from "../services/socketService.js";
import { cloudinary, initCloudinary } from "../config/cloudinary.js";
import { getOrCreateAuthorizedConversation, validateMessageReference } from "../services/chatService.js";
import fs from "fs/promises";
import { requiresPersistentUploadStorage } from "../config/runtime.js";

/**
 * Get or create conversation between two users.
 * Allowed if: they have an ACCEPTED or COMPLETED swap request.
 */
const unreadObject = (value) => value instanceof Map
  ? Object.fromEntries(value)
  : value?.toObject?.() || { ...(value || {}) };

const populatedMessage = (id) => Message.findById(id)
  .populate("sender", "name fullName username profileImage profilePhoto")
  .populate("booking", "bookingCode startAt endAt duration mode status")
  .populate("skill", "name slug category icon")
  .populate("proposal", "status duration deliveryMode offeredSessions requestedSessions")
  .lean();

/**
 * GET /api/chats - list conversations for current user
 */
export const getConversations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { participants: req.user._id };
  const [convos, total] = await Promise.all([
    Conversation.find(filter)
      .populate("participants", "name fullName username profileImage profilePhoto")
      .sort("-lastMessageAt")
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);
  const withOther = convos.map((c) => {
    const other = c.participants.find((p) => p._id.toString() !== req.user._id.toString());
    const unreadCount = unreadObject(c.unreadCount)[req.user._id.toString()] || 0;
    return { ...c, other, unreadCount };
  });
  res.json({ success: true, ...paginatedResponse(withOther, total, page, limit) });
});

/**
 * GET /api/chats/:conversationId/messages - paginated messages
 */
export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.participants.some((p) => p.toString() === req.user._id.toString())) {
    return res.status(404).json({ success: false, message: "Conversation not found" });
  }
  const { page, limit, skip } = getPagination(req.query);
  const [data, total] = await Promise.all([
    Message.find({ conversation: conversationId })
      .populate("sender", "name profileImage")
      .populate("booking", "bookingCode startAt endAt duration mode status")
      .populate("skill", "name slug category icon")
      .populate("proposal", "status duration deliveryMode offeredSessions requestedSessions")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments({ conversation: conversationId }),
  ]);
  res.json({ success: true, ...paginatedResponse(data.reverse(), total, page, limit) });
});

/**
 * POST /api/chats/:conversationId/messages - send message with optional attachments
 */
export const postMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const content = (req.body && req.body.content) || "";
  const files = req.files || [];
  let conv = await Conversation.findById(conversationId);
  if (!conv) {
    return res.status(404).json({ success: false, message: "Conversation not found" });
  }
  if (!conv.participants.some((p) => p.toString() === req.user._id.toString())) {
    return res.status(403).json({ success: false, message: "Not a participant" });
  }
  const reference = await validateMessageReference(req.user._id, conv, req.body || {});
  const clientMessageId = req.body?.clientMessageId || null;
  if (clientMessageId) {
    const replay = await Message.findOne({ sender: req.user._id, clientMessageId }).select("_id").lean();
    if (replay) return res.status(200).json({ success: true, replayed: true, message: await populatedMessage(replay._id) });
  }
  const attachments = [];
  const useCloudinary = initCloudinary();
  if (files.length && !useCloudinary && requiresPersistentUploadStorage()) {
    return res.status(503).json({
      success: false,
      message: "File uploads are temporarily unavailable.",
      error: { code: "UPLOAD_STORAGE_UNAVAILABLE", message: "File uploads are temporarily unavailable." },
    });
  }
  try {
    for (const file of files) {
      let url = `/uploads/${file.filename}`;
      if (useCloudinary) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "skillswap/chat",
          resource_type: "auto",
        });
        url = result.secure_url;
        await fs.unlink(file.path).catch(() => {});
      }
      attachments.push({
        url,
        type: file.mimetype?.startsWith("image/") ? "image" : "document",
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });
    }
  } catch (error) {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
    throw error;
  }
  if (!content.trim() && !attachments.length && !Object.keys(reference).length) {
    return res.status(400).json({ success: false, message: "Message content, attachment, or card is required" });
  }
  const messageType = reference.booking ? "booking"
    : reference.proposal ? "proposal"
      : reference.skill ? "skill"
        : attachments.length ? (attachments.every((item) => item.type === "image") ? "image" : "document")
          : "text";
  let msg;
  try {
    msg = await Message.create({ conversation: conv._id, sender: req.user._id, clientMessageId, content, messageType, attachments: attachments.length ? attachments : undefined, ...reference, seenBy: [req.user._id] });
  } catch (error) {
    if (error?.code === 11000 && clientMessageId) {
      const replay = await Message.findOne({ sender: req.user._id, clientMessageId }).select("_id").lean();
      if (replay) return res.status(200).json({ success: true, replayed: true, message: await populatedMessage(replay._id) });
    }
    throw error;
  }
  const otherId = conv.participants.find((p) => p.toString() !== req.user._id.toString());
  const lastMessageText = content || (attachments.length ? "[Attachment]" : reference.booking ? "[Booking]" : reference.proposal ? "[Proposal]" : "[Skill]");
  const unreadObj = unreadObject(conv.unreadCount);
  const otherIdStr = otherId.toString();
  unreadObj[otherIdStr] = (unreadObj[otherIdStr] || 0) + 1;
  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: lastMessageText.slice(0, 200),
    lastMessageAt: new Date(),
    unreadCount: unreadObj,
  });
  const populated = await populatedMessage(msg._id);
  await createNotification(otherId, {
    type: "NEW_MESSAGE",
    title: "New message",
    body: `${req.user.name}: ${lastMessageText.slice(0, 50)}`,
    link: `/chat?conversation=${conv._id}`,
    metadata: { conversationId: conv._id, messageId: msg._id },
  }).catch(() => {});
  emitToUser(otherId.toString(), "message", populated);
  emitToConversation(conv._id.toString(), "message", populated);
  req.chatUploadsPersisted = !useCloudinary && files.length > 0;
  res.status(201).json({ success: true, message: populated });
});

/**
 * PATCH /api/chats/:conversationId/read - mark conversation as read (reset unread for current user)
 */
export const markConversationRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.participants.some((p) => p.toString() === req.user._id.toString())) {
    return res.status(404).json({ success: false, message: "Conversation not found" });
  }
  const unreadObj = unreadObject(conv.unreadCount);
  delete unreadObj[req.user._id.toString()];
  await Conversation.findByIdAndUpdate(conversationId, { unreadCount: unreadObj });
  await Message.updateMany(
    { conversation: conversationId, sender: { $ne: req.user._id }, seenBy: { $ne: req.user._id } },
    { $addToSet: { seenBy: req.user._id }, $set: { read: true, readAt: new Date() } }
  );
  const otherId = conv.participants.find((participant) => participant.toString() !== req.user._id.toString());
  emitToUser(otherId.toString(), "messages_read", { conversationId, userId: req.user._id.toString(), readAt: new Date() });
  res.json({ success: true });
});

/**
 * POST /api/chats/conversation - get or create conversation with otherUserId (body)
 */
export const getOrCreateChat = asyncHandler(async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId || otherUserId === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: "Invalid user" });
  }
  const conv = await getOrCreateAuthorizedConversation(req.user._id, otherUserId);
  if (!conv) {
    return res.status(403).json({ success: false, message: "An accepted proposal, active booking, or completed swap is required to chat" });
  }
  const populated = await Conversation.findById(conv._id)
    .populate("participants", "name fullName username profileImage profilePhoto")
    .lean();
  res.json({ success: true, conversation: populated });
});
