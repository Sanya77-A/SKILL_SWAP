import { Router } from "express";
import * as roadmap from "../controllers/roadmapController.js";
import { protect } from "../middlewares/auth.js";
import { aiLimiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import {
  addMilestoneSchema,
  addTaskSchema,
  completeMilestoneSchema,
  generateRoadmapSchema,
  listRoadmapsSchema,
  milestoneIdSchema,
  roadmapIdSchema,
  taskIdSchema,
  updateMilestoneSchema,
  updateRoadmapSchema,
  updateTaskSchema,
} from "../validators/roadmap.js";

const router = Router();
router.use(protect);
router.post("/generate", aiLimiter, validate(generateRoadmapSchema), roadmap.generate);
router.get("/", validate(listRoadmapsSchema), roadmap.list);
router.get("/:id", validate(roadmapIdSchema), roadmap.detail);
router.patch("/:id", validate(updateRoadmapSchema), roadmap.update);
router.post("/:id/milestones", validate(addMilestoneSchema), roadmap.createMilestone);
router.patch("/:id/milestones/:milestoneId", validate(updateMilestoneSchema), roadmap.editMilestone);
router.post("/:id/milestones/:milestoneId/complete", validate(completeMilestoneSchema), roadmap.setMilestoneComplete);
router.delete("/:id/milestones/:milestoneId", validate(milestoneIdSchema), roadmap.deleteMilestone);
router.post("/:id/tasks", validate(addTaskSchema), roadmap.createTask);
router.patch("/:id/tasks/:taskId", validate(updateTaskSchema), roadmap.editTask);
router.delete("/:id/tasks/:taskId", validate(taskIdSchema), roadmap.deleteTask);

export default router;
