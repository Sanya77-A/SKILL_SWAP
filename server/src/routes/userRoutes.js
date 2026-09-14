import { Router } from "express";
import * as user from "../controllers/userController.js";
import * as review from "../controllers/reviewController.js";
import { optionalAuth, protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { deleteAccountSchema, listUsersSchema, updateProfileSchema, userIdSchema, userReviewsSchema, usernameSchema } from "../validators/user.js";
import { cleanupUnpersistedProfileUpload, upload, validateUploadedFiles } from "../middlewares/upload.js";
import { getUserSkills } from "../controllers/userSkillController.js";

const router = Router();

router.get("/me", protect, user.getMe);
router.put("/me", protect, upload.single("profileImage"), validateUploadedFiles, cleanupUnpersistedProfileUpload, validate(updateProfileSchema), user.updateMe);
router.delete("/me", protect, validate(deleteAccountSchema), user.deleteMe);
router.get("/", protect, validate(listUsersSchema), user.getUsers);
router.get("/by-username/:username", optionalAuth, validate(usernameSchema), user.getUserByUsername);
router.get("/:id/reviews", protect, validate(userReviewsSchema), review.getReviewsByUser);
router.get("/:id/skills", protect, validate(userIdSchema), getUserSkills);
router.get("/:id", protect, validate(userIdSchema), user.getUserById);

export default router;
