import { z } from "zod";
import { objectId, requestSchema } from "./common.js";

export const issueCertificateSchema = requestSchema({ body: z.object({
  sourceType: z.enum(["challenge", "roadmap", "roadmap_milestone"]),
  sourceId: objectId,
  milestoneId: objectId.optional(),
}).superRefine((value, ctx) => {
  if (value.sourceType === "roadmap_milestone" && !value.milestoneId) ctx.addIssue({ code: "custom", path: ["milestoneId"], message: "Milestone ID is required for milestone certificates" });
  if (value.sourceType !== "roadmap_milestone" && value.milestoneId) ctx.addIssue({ code: "custom", path: ["milestoneId"], message: "Milestone ID is valid only for milestone certificates" });
}) });
export const verifyCertificateSchema = requestSchema({ params: z.object({ id: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/, "Invalid certificate identifier") }) });
export const revokeCertificateSchema = requestSchema({ params: z.object({ id: objectId }), body: z.object({ reason: z.string().trim().min(5).max(500) }) });
