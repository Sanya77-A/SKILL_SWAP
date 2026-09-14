import { asyncHandler } from "../middlewares/asyncHandler.js";
import { actOnProposal, createProposal, listProposals, submitProposal, updateDraft } from "../services/proposalService.js";
import { createNotification } from "../services/notificationService.js";

export const create = asyncHandler(async (req, res) => {
  const proposal = await createProposal(req.user._id, req.body);
  res.status(201).json({ success: true, data: proposal, proposal });
});
export const list = asyncHandler(async (req, res) => {
  const result = await listProposals(req.user._id, req.query);
  res.json({ success: true, ...result });
});
export const update = asyncHandler(async (req, res) => {
  const proposal = await updateDraft(req.user._id, req.params.id, req.body);
  res.json({ success: true, data: proposal, proposal });
});
export const submit = asyncHandler(async (req, res) => {
  const proposal = await submitProposal(req.user._id, req.params.id);
  await createNotification(proposal.recipient._id, { type: "proposal", title: "New swap proposal", body: `${proposal.requester.fullName || proposal.requester.name} sent a proposal`, link: "/proposals", metadata: { proposalId: proposal._id }, dedupeKey: `proposal:${proposal._id}:submitted` });
  res.json({ success: true, data: proposal, proposal });
});
export const action = (name) => asyncHandler(async (req, res) => {
  const proposal = await actOnProposal(req.user._id, req.params.id, name, req.body);
  const other = proposal.requester._id.toString() === req.user._id.toString() ? proposal.recipient : proposal.requester;
  await createNotification(other._id, { type: "proposal", title: `Proposal ${proposal.status}`, body: `${req.user.fullName || req.user.name} ${proposal.status === "countered" ? "countered" : proposal.status} the proposal`, link: "/proposals", metadata: { proposalId: proposal._id, status: proposal.status }, dedupeKey: `proposal:${proposal._id}:${proposal.status}:${proposal.revisions.length}` });
  res.json({ success: true, data: proposal, proposal, message: `Proposal ${proposal.status}` });
});
