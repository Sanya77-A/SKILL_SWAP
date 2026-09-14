import { Router } from "express";
import * as match from "../controllers/matchController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { listMatchesSchema } from "../validators/match.js";

const router = Router();
router.get("/", protect, validate(listMatchesSchema), match.getRecommendedMatches);
export default router;
