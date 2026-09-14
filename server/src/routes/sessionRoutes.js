import { Router } from "express";
import * as session from "../controllers/sessionController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { acceptSessionSchema, createSessionSchema, listSessionsSchema, sessionIdSchema } from "../validators/session.js";

const router = Router();
router.use(protect);
router.post("/", validate(createSessionSchema), session.createSession);
router.get("/", validate(listSessionsSchema), session.getSessions);
router.patch("/:id/accept", validate(acceptSessionSchema), session.acceptSession);
router.patch("/:id/complete", validate(sessionIdSchema), session.completeSession);
export default router;
