import { Router } from "express";
import * as learning from "../controllers/learningController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();
router.use(protect);
router.get("/me", learning.myLearning);

export default router;
