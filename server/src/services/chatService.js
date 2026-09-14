import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { isBlockedBetween } from "./safetyService.js";

export async function canUsersContact(user1Id, user2Id) {
  if (await isBlockedBetween(user1Id, user2Id)) return false;
  const [recipient, legacySwap, proposal, booking] = await Promise.all([
    User.findOne({ _id: user2Id, isDeleted: false, isBlocked: false, status: "active" }).select("messagePermissions").lean(),
    SwapRequest.exists({ status: { $in: ["ACCEPTED", "COMPLETED"] }, $or: [{ sender: user1Id, receiver: user2Id }, { sender: user2Id, receiver: user1Id }] }),
    SwapProposal.exists({ status: { $in: ["accepted", "completed"] }, $or: [{ requester: user1Id, recipient: user2Id }, { requester: user2Id, recipient: user1Id }] }),
    Booking.exists({ status: { $nin: ["cancelled"] }, $or: [{ teacher: user1Id, student: user2Id }, { teacher: user2Id, student: user1Id }] }),
  ]);
  if (!recipient || recipient.messagePermissions === "no_one") return false;
  if (recipient.messagePermissions === "everyone") return true;
  return Boolean(legacySwap || proposal || booking);
}

export async function getOrCreateAuthorizedConversation(user1Id, user2Id) {
  if (await isBlockedBetween(user1Id, user2Id)) return null;
  const participantKey = [user1Id.toString(), user2Id.toString()].sort().join(":");
  const existing = await Conversation.findOne({
    $or: [{ participantKey }, { participants: { $all: [user1Id, user2Id], $size: 2 } }],
  });
  if (existing) {
    if (!existing.participantKey) {
      existing.participantKey = participantKey;
      await existing.save();
    }
    return existing;
  }
  if (!(await canUsersContact(user1Id, user2Id))) return null;
  try {
    return await Conversation.create({ participants: [user1Id, user2Id], participantKey });
  } catch (error) {
    if (error?.code === 11000) return Conversation.findOne({ participantKey });
    throw error;
  }
}

export async function validateMessageReference(userId, conversation, body) {
  const participants = conversation.participants.map((value) => value.toString());
  if (!participants.includes(userId.toString())) throw new ApiError(403, "CONVERSATION_FORBIDDEN", "Not a participant");
  const other = participants.find((value) => value !== userId.toString());
  if (!(await canUsersContact(userId, other))) throw new ApiError(403, "MESSAGE_PERMISSION_DENIED", "This member is not accepting messages from you");
  const reference = {};
  if (body.bookingId) {
    const booking = await Booking.findOne({ _id: body.bookingId, teacher: { $in: conversation.participants }, student: { $in: conversation.participants } });
    if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking card is not available to this conversation");
    reference.booking = booking._id;
  }
  if (body.proposalId) {
    const proposal = await SwapProposal.findOne({ _id: body.proposalId, requester: { $in: conversation.participants }, recipient: { $in: conversation.participants } });
    if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal card is not available to this conversation");
    reference.proposal = proposal._id;
  }
  if (body.skillId) {
    const skill = await Skill.findOne({ _id: body.skillId, status: "active" }).select("_id");
    if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill card not found");
    reference.skill = skill._id;
  }
  return reference;
}
