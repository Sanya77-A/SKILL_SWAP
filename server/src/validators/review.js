import { z } from "zod";
import { objectId } from "./common.js";

const score = z.number().min(1).max(5);
const ratings = z.object({
  communication: score,
  knowledge: score,
  teaching: score,
  punctuality: score,
  professionalism: score,
  overall: score,
});

export const createReviewSchema = z.object({
  body: z.object({
    sessionId: objectId.optional(),
    bookingId: objectId.optional(),
    swapRequestId: objectId.optional(),
    revieweeId: objectId.optional(),
    recipientId: objectId.optional(),
    ratings: ratings.optional(),
    rating: score.optional(),
    comment: z.string().trim().max(2000).optional(),
    wouldLearnAgain: z.boolean().optional(),
  }).superRefine((value, context) => {
    const bookingId = value.sessionId || value.bookingId;
    if (!bookingId && !value.swapRequestId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sessionId"], message: "A completed session is required" });
    if (bookingId && value.swapRequestId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sessionId"], message: "Choose one eligible session" });
    if (bookingId && !value.ratings) context.addIssue({ code: z.ZodIssueCode.custom, path: ["ratings"], message: "All structured ratings are required" });
    if (bookingId && typeof value.wouldLearnAgain !== "boolean") context.addIssue({ code: z.ZodIssueCode.custom, path: ["wouldLearnAgain"], message: "Choose whether you would learn again" });
    if (!bookingId && value.rating == null && !value.ratings) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rating"], message: "Rating is required" });
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});
