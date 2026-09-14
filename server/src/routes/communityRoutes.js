import { Router } from "express";
import * as community from "../controllers/communityController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { commentSchema, communityIdSchema, communityKeySchema, createCommunitySchema, createPostSchema, listCommentsSchema, listCommunitiesSchema, listPostsSchema, memberRoleSchema } from "../validators/community.js";

const router = Router(); router.use(protect);
router.get("/", validate(listCommunitiesSchema), community.list);
router.post("/", validate(createCommunitySchema), community.create);
router.get("/:key", validate(communityKeySchema), community.detail);
router.post("/:id/join", validate(communityIdSchema), community.join);
router.post("/:id/leave", validate(communityIdSchema), community.leave);
router.put("/:id/members/:userId/role", validate(memberRoleSchema), community.role);
router.get("/:id/posts", validate(listPostsSchema), community.posts);
router.post("/:id/posts", validate(createPostSchema), community.publish);
router.get("/:id/posts/:postId/comments", validate(listCommentsSchema), community.comments);
router.post("/:id/posts/:postId/comments", validate(commentSchema), community.comment);
export default router;
