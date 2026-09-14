import { asyncHandler } from "../middlewares/asyncHandler.js";
import { blockMember, createSafetyReport, listBlocks, listModerationDisputes, listModerationReports, listMyDisputes, listMyReports, moderateDispute, moderateReport, openDispute, unblockMember } from "../services/safetyService.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";

const listResponse = async (req, res, loader) => {
  const { page, limit, skip } = getPagination(req.query);
  const { data, total } = await loader({ page, limit, skip });
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
};

export const blocks = asyncHandler(async (req, res) => listResponse(req, res, (pagination) => listBlocks(req.user._id, pagination)));
export const block = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await blockMember(req.user._id, req.params.userId, req.body.reason) }));
export const unblock = asyncHandler(async (req, res) => { await unblockMember(req.user._id, req.params.userId); res.json({ success: true, message: "Member unblocked" }); });
export const report = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await createSafetyReport(req.user._id, req.body) }));
export const myReports = asyncHandler(async (req, res) => listResponse(req, res, (pagination) => listMyReports(req.user._id, pagination)));
export const dispute = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await openDispute(req.user._id, req.params.bookingId, req.body) }));
export const myDisputes = asyncHandler(async (req, res) => listResponse(req, res, (pagination) => listMyDisputes(req.user._id, pagination)));
export const moderationReports = asyncHandler(async (req, res) => listResponse(req, res, (pagination) => listModerationReports(req.query.status ? { status: req.query.status } : {}, pagination)));
export const moderationDisputes = asyncHandler(async (req, res) => listResponse(req, res, (pagination) => listModerationDisputes(req.query.status ? { status: req.query.status } : {}, pagination)));
export const reviewReport = asyncHandler(async (req, res) => res.json({ success: true, data: await moderateReport(req.user._id, req.params.id, req.body.status, req.body.note) }));
export const reviewDispute = asyncHandler(async (req, res) => res.json({ success: true, data: await moderateDispute(req.user._id, req.params.id, req.body.status, req.body.note) }));
