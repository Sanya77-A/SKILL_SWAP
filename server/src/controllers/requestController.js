import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createNotification } from "../services/notificationService.js";
import { sendRequestAcceptedEmail } from "../services/emailService.js";
import { assertCanContact } from "../services/safetyService.js";

/**
 * POST /api/requests
 */
export const createRequest = asyncHandler(async (req, res) => {
  const { receiverId, skillToLearn, skillToTeach, message, proposedSchedule } = req.body;
  if (receiverId === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: "Cannot send request to yourself" });
  }
  await assertCanContact(req.user._id, receiverId);
  const receiver = await User.findById(receiverId);
  if (!receiver || receiver.isDeleted || receiver.isBlocked) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const existing = await SwapRequest.findOne({
    sender: req.user._id,
    receiver: receiverId,
    status: "PENDING",
  });
  if (existing) {
    return res.status(400).json({ success: false, message: "Pending request already exists" });
  }
  const swap = await SwapRequest.create({
    sender: req.user._id,
    receiver: receiverId,
    skillToLearn,
    skillToTeach,
    message: message || "",
    proposedSchedule: proposedSchedule || "",
  });
  const populated = await SwapRequest.findById(swap._id)
    .populate("sender", "name profileImage")
    .populate("receiver", "name profileImage");
  await createNotification(receiverId, {
    type: "NEW_REQUEST",
    title: "New swap request",
    body: `${req.user.name} wants to swap: ${skillToTeach} for ${skillToLearn}`,
    link: `/requests`,
    metadata: { requestId: swap._id },
  });
  res.status(201).json({ success: true, request: populated });
});

/**
 * GET /api/requests?type=incoming|outgoing
 */
export const getRequests = asyncHandler(async (req, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

  let filter = {};
  if (type === "incoming") filter.receiver = req.user._id;
  else if (type === "outgoing") filter.sender = req.user._id;
  else filter = { $or: [{ sender: req.user._id }, { receiver: req.user._id }] };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    SwapRequest.find(filter)
      .populate("sender", "name profileImage email")
      .populate("receiver", "name profileImage email")
      .sort("-createdAt")
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SwapRequest.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { total, page: parseInt(page, 10) || 1, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
  });
});

/**
 * PATCH /api/requests/:id - accept | reject | cancel | complete
 */
export const updateRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const request = await SwapRequest.findById(id).populate("sender", "name email").populate("receiver", "name email");
  if (!request) {
    return res.status(404).json({ success: false, message: "Request not found" });
  }

  const isSender = request.sender._id.toString() === req.user._id.toString();
  const isReceiver = request.receiver._id.toString() === req.user._id.toString();
  if (!isSender && !isReceiver) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  if (action === "accept" || action === "reject") {
    if (!isReceiver) return res.status(403).json({ success: false, message: "Only receiver can accept/reject" });
    if (request.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Request already processed" });
    }
    request.status = action === "accept" ? "ACCEPTED" : "REJECTED";
    await request.save();

    if (action === "accept") {
      import("../models/Conversation.js").then(({ default: Conversation }) => {
        const sorted = [request.sender._id.toString(), request.receiver._id.toString()].sort();
        Conversation.findOne({ participants: { $all: sorted, $size: 2 } }).then((conv) => {
          if (!conv) {
            Conversation.create({ participants: sorted }).catch(() => {});
          }
        });
      });
    }
    const notifUserId = isReceiver ? request.sender._id : request.receiver._id;
    await createNotification(notifUserId, {
      type: action === "accept" ? "REQUEST_ACCEPTED" : "REQUEST_REJECTED",
      title: action === "accept" ? "Swap request accepted" : "Swap request rejected",
      body: action === "accept" ? `${request.receiver.name} accepted your request.` : `${request.receiver.name} rejected your request.`,
      link: "/requests",
      metadata: { requestId: request._id },
    });
    if (action === "accept") {
      await sendRequestAcceptedEmail(request.sender.email, request.receiver.name);
    }
  } else if (action === "cancel") {
    if (!isSender) return res.status(403).json({ success: false, message: "Only sender can cancel" });
    if (request.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Can only cancel pending request" });
    }
    request.status = "CANCELED";
    await request.save();
  } else if (action === "complete") {
    if (!isSender && !isReceiver) return;
    if (request.status !== "ACCEPTED") {
      return res.status(400).json({ success: false, message: "Only accepted requests can be completed" });
    }
    request.status = "COMPLETED";
    await request.save();
    const otherId = isSender ? request.receiver._id : request.sender._id;
    await createNotification(otherId, {
      type: "REQUEST_COMPLETED",
      title: "Swap completed",
      body: "Your swap has been marked complete. You can now leave a review.",
      link: "/requests",
      metadata: { requestId: request._id },
    });
  } else {
    return res.status(400).json({ success: false, message: "Invalid action" });
  }

  const updated = await SwapRequest.findById(id)
    .populate("sender", "name profileImage email")
    .populate("receiver", "name profileImage email");
  res.json({ success: true, request: updated });
});
