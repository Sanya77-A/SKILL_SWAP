import { z } from "zod";
import { activityTypes } from "../models/Activity.js";
import { limit, objectId, page, requestSchema } from "./common.js";
export const feedSchema = requestSchema({ query: z.object({ type: z.enum(activityTypes).optional(), saved: z.coerce.boolean().optional(), page, limit }) });
export const activityIdSchema = requestSchema({ params: z.object({ id: objectId }) });
export const commentsSchema = requestSchema({ params: z.object({ id: objectId }), query: z.object({ page, limit }) });
export const createCommentSchema = requestSchema({ params: z.object({ id: objectId }), body: z.object({ body: z.string().trim().min(1).max(1500) }) });
export const commentIdSchema = requestSchema({ params: z.object({ commentId: objectId }) });
