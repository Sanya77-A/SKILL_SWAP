import Session from "../models/Session.js";
import SwapRequest from "../models/SwapRequest.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createNotification } from "../services/notificationService.js";

/**
 * POST /api/sessions
 */
export const createSession = asyncHandler(async (req, res) => {
  const { requestId, proposedSlots } = req.body;
  const request = await SwapRequest.findById(requestId);
  if (!request) return res.status(404).json({ success: false, message: "Request not found" });
  if (request.status !== "ACCEPTED") {
    return res.status(400).json({ success: false, message: "Only accepted requests can have sessions" });
  }
  const teacherId = request.receiver.toString();
  const studentId = request.sender.toString();
  if (req.user._id.toString() !== teacherId && req.user._id.toString() !== studentId) {
    return res.status(403).json({ success: false, message: "Not a participant" });
  }
  const existing = await Session.findOne({ requestId });
  if (existing) return res.status(400).json({ success: false, message: "Session already exists" });
  const session = await Session.create({
    requestId,
    teacherId,
    studentId,
    proposedSlots: proposedSlots || [],
  });
  const otherId = req.user._id.toString() === teacherId ? studentId : teacherId;
  await createNotification(otherId, {
    type: "NEW_REQUEST",
    title: "Session proposed",
    message: "Proposed time slots for your swap",
    link: "/requests",
    metadata: { sessionId: session._id },
  });
  res.status(201).json({ success: true, session });
});

/**
 * PATCH /api/sessions/:id/accept — accept a slot
 */
export const acceptSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { acceptedSlot } = req.body;
  const session = await Session.findById(id);
  if (!session) return res.status(404).json({ success: false, message: "Session not found" });
  const isParticipant = [session.teacherId, session.studentId].some((p) => p.toString() === req.user._id.toString());
  if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });
  if (session.status !== "PROPOSED") {
    return res.status(400).json({ success: false, message: "Session already processed" });
  }
  if (!acceptedSlot || !session.proposedSlots.includes(acceptedSlot)) {
    return res.status(400).json({ success: false, message: "Invalid slot" });
  }
  session.acceptedSlot = acceptedSlot;
  session.status = "CONFIRMED";
  await session.save();
  const otherId = session.teacherId.toString() === req.user._id.toString() ? session.studentId : session.teacherId;
  await createNotification(otherId, {
    type: "SESSION_CONFIRMED",
    title: "Session confirmed",
    message: `Slot confirmed: ${acceptedSlot}`,
    link: "/requests",
    metadata: { sessionId: session._id },
  });
  res.json({ success: true, session });
});

/**
 * PATCH /api/sessions/:id/complete
 */
export const completeSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: "Session not found" });
  const isParticipant = [session.teacherId, session.studentId].some((p) => p.toString() === req.user._id.toString());
  if (!isParticipant) return res.status(403).json({ success: false, message: "Not a participant" });
  if (session.status !== "CONFIRMED") {
    return res.status(400).json({ success: false, message: "Only confirmed sessions can be completed" });
  }
  session.status = "COMPLETED";
  await session.save();
  res.json({ success: true, session });
});

/**
 * GET /api/sessions
 */
export const getSessions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const filter = {
    $or: [{ teacherId: req.user._id }, { studentId: req.user._id }],
  };
  if (req.query.status) filter.status = req.query.status;
  const [data, total] = await Promise.all([
    Session.find(filter)
      .populate("requestId")
      .populate("teacherId", "name")
      .populate("studentId", "name")
      .sort("-createdAt")
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Session.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data,
    pagination: { total, page: parseInt(page, 10) || 1, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
  });
});
