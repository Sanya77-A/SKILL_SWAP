import { z } from "zod";
import { page, limit, requestSchema } from "./common.js";

export const createRequestSchema = z.object({
  body: z.object({
    receiverId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user id"),
    skillToLearn: z.string().min(1).max(100),
    skillToTeach: z.string().min(1).max(100),
    message: z.string().max(500).optional(),
    proposedSchedule: z.string().max(200).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateRequestSchema = z.object({
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
  body: z.object({
    action: z.enum(["accept", "reject", "cancel", "complete"]),
  }),
  query: z.any().optional(),
});

export const listRequestsSchema = requestSchema({
  query: z.object({
    type: z.enum(["incoming", "outgoing"]).optional(),
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELED", "COMPLETED"]).optional(),
    page,
    limit,
  }),
});
