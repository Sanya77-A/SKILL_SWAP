import { z } from "zod";
import { limit, objectId, optionalHttpUrl, page, requestSchema } from "./common.js";

const slug = z.string().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const listCommunitiesSchema = requestSchema({ query: z.object({ q: z.string().trim().max(100).optional(), skillId: objectId.optional(), joined: z.coerce.boolean().optional(), page, limit }) });
export const createCommunitySchema = requestSchema({ body: z.object({
  name: z.string().trim().min(2).max(120), slug: slug.optional(), description: z.string().trim().min(10).max(3000), skillId: objectId.optional(), category: z.string().trim().max(100).default(""), visibility: z.enum(["public", "private"]).default("public"), rules: z.array(z.string().trim().min(2).max(500)).max(20).default([]),
}) });
export const communityKeySchema = requestSchema({ params: z.object({ key: z.string().trim().min(2).max(140) }) });
export const communityIdSchema = requestSchema({ params: z.object({ id: objectId }) });
export const memberRoleSchema = requestSchema({ params: z.object({ id: objectId, userId: objectId }), body: z.object({ role: z.enum(["admin", "moderator", "member"]) }) });
export const listPostsSchema = requestSchema({ params: z.object({ id: objectId }), query: z.object({ type: z.enum(["post", "question", "resource"]).optional(), page, limit }) });
export const createPostSchema = requestSchema({ params: z.object({ id: objectId }), body: z.object({
  type: z.enum(["post", "question", "resource"]).default("post"), title: z.string().trim().max(200).default(""), content: z.string().trim().min(2).max(8000), resourceUrl: optionalHttpUrl.default(""),
}).superRefine((value, ctx) => { if (value.type === "resource" && !value.resourceUrl) ctx.addIssue({ code: "custom", path: ["resourceUrl"], message: "Resource posts require a URL" }); }) });
export const commentSchema = requestSchema({ params: z.object({ id: objectId, postId: objectId }), body: z.object({ content: z.string().trim().min(1).max(3000) }) });
export const listCommentsSchema = requestSchema({ params: z.object({ id: objectId, postId: objectId }), query: z.object({ page, limit }) });
