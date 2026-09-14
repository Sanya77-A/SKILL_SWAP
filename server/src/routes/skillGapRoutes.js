import { Router } from "express";
import * as skillGap from "../controllers/skillGapController.js";
import { protect } from "../middlewares/auth.js";
import { aiLimiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import { analyzeSkillGapSchema, skillGapHistorySchema, skillGapIdSchema } from "../validators/skillGap.js";

const router = Router();
router.use(protect);
router.post("/analyze", aiLimiter, validate(analyzeSkillGapSchema), skillGap.analyze);
router.get("/", validate(skillGapHistorySchema), skillGap.history);
router.get("/:id", validate(skillGapIdSchema), skillGap.detail);

export default router;
