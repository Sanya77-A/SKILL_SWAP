import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import SwapRequest from "../models/SwapRequest.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { recalculateReputation } from "../services/reputationService.js";
import { createNotification } from "../services/notificationService.js";

const reviewerPopulate = "name fullName username profileImage profilePhoto";

async function createBookingReview(userId, body) {
  const bookingId = body.sessionId || body.bookingId;
  const booking = await Booking.findById(bookingId).select("teacher student status").lean();
  if (!booking) throw new ApiError(404, "SESSION_NOT_FOUND", "Completed session not found");
  if (booking.status !== "completed") throw new ApiError(409, "SESSION_NOT_COMPLETED", "Only completed sessions can be reviewed");
  const user = userId.toString();
  const teacher = booking.teacher.toString();
  const student = booking.student.toString();
  if (user !== teacher && user !== student) throw new ApiError(403, "REVIEW_FORBIDDEN", "Only session participants can leave a review");
  const reviewee = user === teacher ? booking.student : booking.teacher;
  if (reviewee.toString() === user) throw new ApiError(400, "SELF_REVIEW_FORBIDDEN", "You cannot review yourself");
  const submittedReviewee = body.revieweeId || body.recipientId;
  if (submittedReviewee === user) throw new ApiError(400, "SELF_REVIEW_FORBIDDEN", "You cannot review yourself");
  if (submittedReviewee && submittedReviewee !== reviewee.toString()) {
    throw new ApiError(400, "INVALID_REVIEWEE", "Reviewee must be the other session participant");
  }
  const existing = await Review.exists({ reviewer: userId, session: booking._id });
  if (existing) throw new ApiError(409, "REVIEW_EXISTS", "You already reviewed this session");
  const review = await Review.create({
    reviewer: userId,
    reviewee,
    author: userId,
    recipient: reviewee,
    session: booking._id,
    // Retain compatibility with the original non-sparse compound uniqueness until all deployments migrate that index.
    swapRequest: booking._id,
    ratings: body.ratings,
    rating: body.ratings.overall,
    comment: body.comment || "",
    wouldLearnAgain: body.wouldLearnAgain,
  });
  return { review, reviewee };
}

async function createLegacyReview(userId, body) {
  const swap = await SwapRequest.findById(body.swapRequestId);
  if (!swap) throw new ApiError(404, "SWAP_NOT_FOUND", "Swap request not found");
  if (swap.status !== "COMPLETED") throw new ApiError(409, "SWAP_NOT_COMPLETED", "Only completed swaps can be reviewed");
  const user = userId.toString();
  if (![swap.sender.toString(), swap.receiver.toString()].includes(user)) {
    throw new ApiError(403, "REVIEW_FORBIDDEN", "Only swap participants can leave a review");
  }
  const reviewee = swap.sender.toString() === user ? swap.receiver : swap.sender;
  const submittedReviewee = body.revieweeId || body.recipientId;
  if (submittedReviewee === user) throw new ApiError(400, "SELF_REVIEW_FORBIDDEN", "You cannot review yourself");
  if (submittedReviewee && submittedReviewee !== reviewee.toString()) throw new ApiError(400, "INVALID_REVIEWEE", "Reviewee must be the other participant");
  const ratings = body.ratings || Object.fromEntries(["communication", "knowledge", "teaching", "punctuality", "professionalism", "overall"].map((key) => [key, body.rating]));
  const review = await Review.create({ reviewer: userId, reviewee, author: userId, recipient: reviewee, swapRequest: swap._id, ratings, rating: ratings.overall, comment: body.comment || "", wouldLearnAgain: body.wouldLearnAgain ?? true });
  return { review, reviewee };
}

export const createReview = asyncHandler(async (req, res) => {
  let result;
  try {
    result = req.body.sessionId || req.body.bookingId
      ? await createBookingReview(req.user._id, req.body)
      : await createLegacyReview(req.user._id, req.body);
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "REVIEW_EXISTS", "You already reviewed this session");
    throw error;
  }
  const [review, reputation] = await Promise.all([
    Review.findById(result.review._id)
      .populate("reviewer", reviewerPopulate)
      .populate("author", reviewerPopulate)
      .populate("session", "bookingCode startAt endAt skill status")
      .lean(),
    recalculateReputation(result.reviewee),
  ]);
  await createNotification(result.reviewee, { type: "review", title: "New verified review", body: `${req.user.fullName || req.user.name} left you a ${review.ratings.overall}/5 review`, link: "/profile", metadata: { reviewId: review._id, sessionId: review.session?._id }, dedupeKey: `review:${review._id}` });
  res.status(201).json({ success: true, data: review, review, reputation });
});

export const getReviewsByUser = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { $or: [{ reviewee: req.params.id }, { recipient: req.params.id }], moderationStatus: { $ne: "hidden" } };
  const [data, total] = await Promise.all([
    Review.find(filter)
      .populate("reviewer", reviewerPopulate)
      .populate("author", reviewerPopulate)
      .populate("session", "bookingCode startAt endAt skill status")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});
