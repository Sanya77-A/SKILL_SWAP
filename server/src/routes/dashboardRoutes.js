import { Router } from "express";
import * as dashboard from "../controllers/dashboardController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();
router.get("/stats", protect, dashboard.getDashboardStats);
export default router;
