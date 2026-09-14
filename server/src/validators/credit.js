import { z } from "zod";
import { limit, objectId, page, requestSchema } from "./common.js";
import { creditTransactionTypes } from "../models/CreditTransaction.js";

export const listTransactionsSchema = requestSchema({
  query: z.object({ page, limit, type: z.enum(creditTransactionTypes).optional() }),
});

export const adminAdjustmentSchema = requestSchema({
  body: z.object({
    userId: objectId,
    amount: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, "Amount cannot be zero"),
    idempotencyKey: z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9:_-]+$/),
    description: z.string().trim().min(3).max(500),
  }),
});
