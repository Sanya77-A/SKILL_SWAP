import { Router } from "express";
import * as report from "../controllers/reportController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createReportSchema } from "../validators/report.js";

const router = Router();
router.post("/", protect, validate(createReportSchema), report.createReport);
export default router;
