import CreditTransaction from "../models/CreditTransaction.js";
import User from "../models/User.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { applyCredit, getWalletSnapshot } from "../services/creditService.js";

export const getWallet = asyncHandler(async (req, res) => {
  const wallet = await getWalletSnapshot(req.user._id);
  res.json({ success: true, data: wallet, wallet });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.type) filter.type = req.query.type;
  const [data, total] = await Promise.all([
    CreditTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CreditTransaction.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const adminAdjustment = asyncHandler(async (req, res) => {
  const target = await User.exists({ _id: req.body.userId, isDeleted: false });
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
  const result = await applyCredit({
    userId: req.body.userId,
    amount: req.body.amount,
    type: "admin_adjustment",
    idempotencyKey: `admin:${req.user._id}:${req.body.idempotencyKey}`,
    relatedEntity: { kind: "user", id: req.body.userId },
    description: req.body.description,
  });
  res.status(result.replayed ? 200 : 201).json({ success: true, data: result.transaction, transaction: result.transaction, replayed: result.replayed });
});
