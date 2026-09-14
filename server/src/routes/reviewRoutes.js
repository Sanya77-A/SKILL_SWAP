import { Router } from "express";
import * as review from "../controllers/reviewController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createReviewSchema } from "../validators/review.js";

const router = Router();
router.post("/", protect, validate(createReviewSchema), review.createReview);
export default router;
