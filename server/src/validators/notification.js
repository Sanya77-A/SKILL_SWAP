import { z } from "zod";
import { idParams, page, limit, requestSchema } from "./common.js";
import { notificationTypes } from "../models/Notification.js";

export const listNotificationsSchema = requestSchema({
  query: z.object({ page, limit, unreadOnly: z.enum(["true", "false"]).optional(), type: z.enum(notificationTypes).optional() }),
});

export const notificationIdSchema = requestSchema({ params: idParams() });

export const notificationPreferencesSchema = requestSchema({
  body: z.object({
    inApp: z.object(Object.fromEntries(notificationTypes.map((type) => [type, z.boolean().optional()]))).partial().optional(),
    emailDigest: z.enum(["off", "daily", "weekly"]).optional(),
    pushEnabled: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, "At least one preference is required"),
});
