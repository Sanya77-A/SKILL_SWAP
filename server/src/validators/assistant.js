import { z } from "zod";
import { limit, objectId, page, requestSchema } from "./common.js";
import { supportedIntents } from "../services/ai/intentRouter.js";

export const askAssistantSchema = requestSchema({
  body: z.object({
    message: z.string().trim().min(2).max(4000),
    intent: z.enum(supportedIntents).optional(),
    targetUserId: objectId.optional(),
    bookingId: objectId.optional(),
  }),
});

export const assistantHistorySchema = requestSchema({ query: z.object({ page, limit }) });
