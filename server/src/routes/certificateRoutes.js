import { Router } from "express";
import * as certificate from "../controllers/certificateController.js";
import { protect } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { issueCertificateSchema, revokeCertificateSchema, verifyCertificateSchema } from "../validators/certificate.js";

const router = Router();
router.get("/verify/:id", validate(verifyCertificateSchema), certificate.verify);
router.use(protect);
router.get("/me", certificate.mine);
router.get("/eligibility", certificate.eligibility);
router.post("/issue", validate(issueCertificateSchema), certificate.issue);
router.post("/:id/revoke", adminOnly, validate(revokeCertificateSchema), certificate.revoke);
export default router;
