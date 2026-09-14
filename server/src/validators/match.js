import { z } from "zod";
import { page, limit, requestSchema } from "./common.js";

export const listMatchesSchema = requestSchema({
  query: z.object({
    page,
    limit,
    experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
    availability: z.union([z.string().trim().max(100), z.array(z.string().trim().max(100)).max(10)]).optional(),
  }),
});
