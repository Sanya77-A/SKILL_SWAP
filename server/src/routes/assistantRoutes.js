import { Router } from "express";
import * as assistant from "../controllers/assistantController.js";
import { protect } from "../middlewares/auth.js";
import { aiLimiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import { askAssistantSchema, assistantHistorySchema } from "../validators/assistant.js";

const router = Router();
router.use(protect, aiLimiter);
router.post("/ask", validate(askAssistantSchema), assistant.ask);
router.get("/history", validate(assistantHistorySchema), assistant.history);

export default router;
