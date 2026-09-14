import { z } from "zod";
import { idParams, limit, page, requestSchema } from "./common.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const schedule = z.object({
  startAt: z.coerce.date().refine((value) => value > new Date(), "Schedule must be in the future"),
  endAt: z.coerce.date(),
  timezone: z.string().trim().min(1).max(100),
}).refine((value) => value.endAt > value.startAt, { message: "End time must be after start time", path: ["endAt"] });
const terms = {
  offeredSessions: z.number().int().min(0).max(100).default(1),
  requestedSessions: z.number().int().min(1).max(100).default(1),
  duration: z.number().int().min(15).max(240).refine((value) => value % 15 === 0, "Use 15-minute increments"),
  proposedSchedule: z.array(schedule).max(10).default([]),
  deliveryMode: z.enum(["video", "audio", "in_person"]),
  message: z.string().trim().max(2000).default(""),
  optionalCredits: z.number().int().min(0).max(1_000_000).default(0),
  optionalPayment: z.object({ amount: z.number().min(0.01).max(1_000_000), currency: z.string().trim().toUpperCase().length(3) }).nullable().default(null),
};

export const createProposalSchema = requestSchema({
  body: z.object({ recipientId: objectId, listingId: objectId.optional(), offeredSkillId: objectId, requestedSkillId: objectId, ...terms }),
});
export const updateProposalSchema = requestSchema({
  params: idParams(), body: z.object(terms).partial().refine((value) => Object.keys(value).length > 0, "No changes supplied"),
});
export const counterProposalSchema = requestSchema({
  params: idParams(), body: z.object(terms).partial().refine((value) => Object.keys(value).length > 0, "Counter terms are required"),
});
export const proposalIdSchema = requestSchema({ params: idParams() });
export const listProposalsSchema = requestSchema({
  query: z.object({
    type: z.enum(["all", "incoming", "outgoing"]).default("all"),
    status: z.enum(["draft", "pending", "accepted", "countered", "declined", "cancelled", "expired", "completed"]).optional(),
    page, limit,
  }),
});
