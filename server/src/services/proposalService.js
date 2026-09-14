import Listing from "../models/Listing.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { ApiError } from "../utils/ApiError.js";
import { assertCanContact } from "./safetyService.js";

const editableFields = ["offeredSessions", "requestedSessions", "duration", "proposedSchedule", "deliveryMode", "message", "optionalCredits", "optionalPayment"];
const populate = [
  { path: "requester", select: "name fullName username profileImage profilePhoto headline ratingAvg skillScore" },
  { path: "recipient", select: "name fullName username profileImage profilePhoto headline ratingAvg skillScore" },
  { path: "offeredSkill", select: "name slug category icon" },
  { path: "requestedSkill", select: "name slug category icon" },
  { path: "listing", select: "title slug status exchangeEnabled creditsEnabled paidEnabled creditCost price currency" },
];

const snapshot = (proposal, actor) => ({
  actor,
  ...Object.fromEntries(editableFields.map((field) => [field, proposal[field]])),
  createdAt: new Date(),
});

async function expireIfNeeded(proposal) {
  if (["pending", "countered"].includes(proposal.status) && proposal.expiresAt <= new Date()) {
    proposal.status = "expired";
    proposal.actionRequiredBy = null;
    await proposal.save();
  }
  return proposal;
}

async function assertTeaching(userId, skillId, label) {
  const record = await UserSkill.exists({ user: userId, skill: skillId, teachingEnabled: true });
  if (!record) throw new ApiError(400, "TEACHING_SKILL_REQUIRED", `${label} must be enabled for teaching`);
}

export async function createProposal(requesterId, payload) {
  if (requesterId.toString() === payload.recipientId) throw new ApiError(400, "SELF_PROPOSAL", "You cannot send a proposal to yourself");
  await assertCanContact(requesterId, payload.recipientId);
  const recipient = await User.exists({ _id: payload.recipientId, isDeleted: false, isBlocked: false, status: "active" });
  if (!recipient) throw new ApiError(404, "RECIPIENT_NOT_FOUND", "Recipient not found");
  await Promise.all([
    assertTeaching(requesterId, payload.offeredSkillId, "Offered skill"),
    assertTeaching(payload.recipientId, payload.requestedSkillId, "Requested skill"),
  ]);
  if (payload.listingId) {
    const listing = await Listing.findOne({ _id: payload.listingId, owner: payload.recipientId, skill: payload.requestedSkillId, status: "published" });
    if (!listing) throw new ApiError(400, "LISTING_MISMATCH", "Published listing does not match this recipient and requested skill");
  }
  const proposal = await SwapProposal.create({
    requester: requesterId,
    recipient: payload.recipientId,
    listing: payload.listingId || null,
    offeredSkill: payload.offeredSkillId,
    requestedSkill: payload.requestedSkillId,
    ...Object.fromEntries(editableFields.filter((field) => payload[field] !== undefined).map((field) => [field, payload[field]])),
  });
  await proposal.populate(populate);
  return proposal;
}

export async function updateDraft(requesterId, proposalId, payload) {
  const proposal = await SwapProposal.findOne({ _id: proposalId, requester: requesterId });
  if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  if (proposal.status !== "draft") throw new ApiError(409, "PROPOSAL_NOT_EDITABLE", "Only draft proposals can be edited");
  Object.assign(proposal, Object.fromEntries(editableFields.filter((field) => payload[field] !== undefined).map((field) => [field, payload[field]])));
  await proposal.save();
  await proposal.populate(populate);
  return proposal;
}

export async function submitProposal(requesterId, proposalId) {
  const proposal = await SwapProposal.findOne({ _id: proposalId, requester: requesterId });
  if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  if (proposal.status !== "draft") throw new ApiError(409, "INVALID_PROPOSAL_TRANSITION", "Only drafts can be submitted");
  proposal.status = "pending";
  proposal.actionRequiredBy = proposal.recipient;
  proposal.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await proposal.save();
  await proposal.populate(populate);
  return proposal;
}

export async function actOnProposal(actorId, proposalId, action, payload = {}) {
  const proposal = await SwapProposal.findOne({ _id: proposalId, $or: [{ requester: actorId }, { recipient: actorId }] });
  if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  await expireIfNeeded(proposal);
  if (["expired", "accepted", "declined", "cancelled", "completed"].includes(proposal.status)) {
    throw new ApiError(409, "PROPOSAL_FINAL", `A ${proposal.status} proposal cannot be changed`);
  }
  const actor = actorId.toString();
  const isRequester = proposal.requester.toString() === actor;

  if (action === "cancel") {
    if (!isRequester) throw new ApiError(403, "REQUESTER_ONLY", "Only the requester can cancel this proposal");
    proposal.status = "cancelled";
    proposal.actionRequiredBy = null;
  } else {
    if (!["pending", "countered"].includes(proposal.status) || proposal.actionRequiredBy?.toString() !== actor) {
      throw new ApiError(403, "ACTION_NOT_ALLOWED", "This proposal is not awaiting your response");
    }
    if (action === "accept") {
      proposal.status = "accepted";
      proposal.actionRequiredBy = null;
      proposal.acceptedAt = new Date();
    } else if (action === "decline") {
      proposal.status = "declined";
      proposal.actionRequiredBy = null;
    } else if (action === "counter") {
      proposal.revisions.push(snapshot(proposal, actorId));
      Object.assign(proposal, Object.fromEntries(editableFields.filter((field) => payload[field] !== undefined).map((field) => [field, payload[field]])));
      proposal.status = "countered";
      proposal.actionRequiredBy = isRequester ? proposal.recipient : proposal.requester;
      proposal.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    proposal.respondedAt = new Date();
  }
  await proposal.save();
  await proposal.populate(populate);
  return proposal;
}

export async function listProposals(userId, { type, status, page, limit }) {
  await SwapProposal.updateMany(
    { status: { $in: ["pending", "countered"] }, expiresAt: { $lte: new Date() } },
    { status: "expired", actionRequiredBy: null }
  );
  const filter = type === "incoming" ? { recipient: userId } : type === "outgoing" ? { requester: userId } : { $or: [{ requester: userId }, { recipient: userId }] };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    SwapProposal.find(filter).populate(populate).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    SwapProposal.countDocuments(filter),
  ]);
  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
}
