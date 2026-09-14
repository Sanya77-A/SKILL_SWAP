import { z } from "zod";
import { idParams, objectId, page, limit, requestSchema } from "./common.js";

export const postMessageSchema = z.object({
  params: idParams("conversationId"),
  body: z.object({
    content: z.string().max(2000).optional(),
    clientMessageId: z.string().uuid().optional(),
    bookingId: objectId.optional(),
    skillId: objectId.optional(),
    proposalId: objectId.optional(),
  }).refine((value) => [value.bookingId, value.skillId, value.proposalId].filter(Boolean).length <= 1, "Attach only one card per message"),
  query: z.any().optional(),
});

export const createConversationSchema = requestSchema({
  body: z.object({ otherUserId: objectId }),
});

export const conversationMessagesSchema = requestSchema({
  params: idParams("conversationId"),
  query: z.object({ page, limit }),
});

export const conversationIdSchema = requestSchema({ params: idParams("conversationId") });
