import { Router } from "express";
import * as userSkill from "../controllers/userSkillController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createUserSkillSchema, updateUserSkillSchema, userSkillIdSchema } from "../validators/skill.js";

const router = Router();

router.use(protect);
router.get("/me", userSkill.getMySkills);
router.post("/me", validate(createUserSkillSchema), userSkill.addMySkill);
router.patch("/me/:id", validate(updateUserSkillSchema), userSkill.updateMySkill);
router.post("/me/:id/request-verification", validate(userSkillIdSchema), userSkill.requestVerification);
router.delete("/me/:id", validate(userSkillIdSchema), userSkill.deleteMySkill);

export default router;
