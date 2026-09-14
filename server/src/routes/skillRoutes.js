import { Router } from "express";
import * as skill from "../controllers/skillController.js";
import { protect } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import {
  createSkillSchema,
  listSkillsSchema,
  skillIdentifierSchema,
  skillIdSchema,
  updateSkillSchema,
} from "../validators/skill.js";

const router = Router();

router.get("/", validate(listSkillsSchema), skill.listSkills);
router.post("/", protect, adminOnly, validate(createSkillSchema), skill.createSkill);
router.patch("/:id", protect, adminOnly, validate(updateSkillSchema), skill.updateSkill);
router.delete("/:id", protect, adminOnly, validate(skillIdSchema), skill.archiveSkill);
router.get("/:identifier", validate(skillIdentifierSchema), skill.getSkill);

export default router;
