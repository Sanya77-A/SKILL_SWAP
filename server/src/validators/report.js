import { z } from "zod";
import { objectId, requestSchema } from "./common.js";

export const createReportSchema = requestSchema({
  body: z.object({
    reportedUserId: objectId,
    reason: z.string().trim().min(5).max(1000),
  }),
});
