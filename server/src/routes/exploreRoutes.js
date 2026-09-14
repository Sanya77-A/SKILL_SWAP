import { Router } from "express";
import * as explore from "../controllers/exploreController.js";
import { optionalAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { exploreSearchSchema } from "../validators/explore.js";

const router = Router();

router.get("/", optionalAuth, explore.sections);
router.get("/search", optionalAuth, validate(exploreSearchSchema), explore.search);

export default router;
