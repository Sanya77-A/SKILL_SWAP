import { Router } from "express";
import * as careerPath from "../controllers/careerPathController.js";
import { protect } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { createCareerPathSchema, listCareerPathsSchema, updateCareerPathSchema } from "../validators/skillGap.js";

const router = Router();
router.use(protect);
router.get("/", validate(listCareerPathsSchema), careerPath.list);
router.post("/", adminOnly, validate(createCareerPathSchema), careerPath.create);
router.patch("/:id", adminOnly, validate(updateCareerPathSchema), careerPath.update);

export default router;
