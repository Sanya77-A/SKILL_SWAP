import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getEligibility, issueCertificate, listMyCertificates, revokeCertificate, verifyCertificate } from "../services/certificateService.js";

export const eligibility = asyncHandler(async (req, res) => res.json({ success: true, data: await getEligibility(req.user._id) }));
export const mine = asyncHandler(async (req, res) => res.json({ success: true, data: await listMyCertificates(req.user._id) }));
export const issue = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await issueCertificate(req.user._id, req.body) }));
export const verify = asyncHandler(async (req, res) => res.json({ success: true, data: await verifyCertificate(req.params.id) }));
export const revoke = asyncHandler(async (req, res) => res.json({ success: true, data: await revokeCertificate(req.params.id, req.user._id, req.body.reason) }));
