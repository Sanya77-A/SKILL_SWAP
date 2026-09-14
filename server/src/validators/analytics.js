import { z } from "zod";
import { requestSchema } from "./common.js";
export const mentorAnalyticsSchema = requestSchema({ query: z.object({ rangeDays: z.union([z.coerce.number().int().refine((value) => [7, 30, 90, 365].includes(value)), z.literal("all")]).default(30) }) });
