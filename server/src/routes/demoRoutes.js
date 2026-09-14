import { Router } from "express";
import { authLimiter } from "../middlewares/rateLimits.js";
import { demoOnly, protectDemo } from "../middlewares/demoAuth.js";
import * as demo from "../controllers/demoController.js";

const router = Router();

router.use(demoOnly);
router.get("/status", demo.status);
router.post("/login", authLimiter, demo.login);
router.post("/logout", demo.logout);
router.get("/me", protectDemo, demo.me);
router.get("/dashboard", protectDemo, demo.dashboard);
router.get("/explore", protectDemo, demo.explore);
router.get("/mentors/:id", protectDemo, demo.mentor);

export default router;
