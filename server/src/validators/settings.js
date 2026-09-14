import { z } from "zod";
import { idParams, requestSchema } from "./common.js";
export const accountSchema = requestSchema({ body: z.object({ email: z.string().trim().toLowerCase().email().max(254), currentPassword: z.string().min(8).max(128) }) });
export const privacySchema = requestSchema({ body: z.object({ profileVisibility: z.enum(["public", "members", "private"]), locationVisibility: z.enum(["public", "members", "private"]), showOnlineStatus: z.boolean(), showLastActive: z.boolean(), messagePermissions: z.enum(["everyone", "matches", "no_one"]) }) });
export const learningSchema = requestSchema({ body: z.object({ preferredLearningMode: z.enum(["online", "in_person", "hybrid"]), preferredTeachingMode: z.enum(["online", "in_person", "hybrid"]), experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]), preferredExchangeModels: z.array(z.enum(["exchange", "credits", "paid"])).min(1).max(3), maxCreditCost: z.number().min(0).nullable(), maxSessionPrice: z.number().min(0).nullable(), preferredCurrency: z.string().trim().toUpperCase().length(3), learningGoals: z.array(z.string().trim().min(1).max(300)).max(20) }) });
export const accessibilitySchema = requestSchema({ body: z.object({ reducedMotion: z.boolean(), highContrast: z.boolean() }) });
export const sessionIdSchema = requestSchema({ params: idParams() });
export const deleteSettingsAccountSchema = requestSchema({ body: z.object({ currentPassword: z.string().min(8).max(128), confirmation: z.literal("DELETE") }) });
