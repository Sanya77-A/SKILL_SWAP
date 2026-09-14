import { Router } from "express";
import * as request from "../controllers/requestController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createRequestSchema, listRequestsSchema, updateRequestSchema } from "../validators/request.js";

const router = Router();
router.use(protect);
router.post("/", validate(createRequestSchema), request.createRequest);
router.get("/", validate(listRequestsSchema), request.getRequests);
router.patch("/:id", validate(updateRequestSchema), request.updateRequest);
export default router;
