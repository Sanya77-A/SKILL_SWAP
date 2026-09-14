import { z } from "zod";
import { idParams, objectId, page, limit, requestSchema } from "./common.js";

const slot = z.string().trim().min(1).max(100);

export const createSessionSchema = requestSchema({
  body: z.object({
    requestId: objectId,
    proposedSlots: z.array(slot).min(1).max(10),
  }),
});

export const acceptSessionSchema = requestSchema({
  params: idParams(),
  body: z.object({ acceptedSlot: slot }),
});

export const sessionIdSchema = requestSchema({ params: idParams() });

export const listSessionsSchema = requestSchema({
  query: z.object({
    page,
    limit,
    status: z.enum(["PROPOSED", "CONFIRMED", "COMPLETED"]).optional(),
  }),
});
