import { Router } from "express";
import * as proposal from "../controllers/proposalController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { counterProposalSchema, createProposalSchema, listProposalsSchema, proposalIdSchema, updateProposalSchema } from "../validators/proposal.js";

const router = Router();
router.use(protect);
router.get("/", validate(listProposalsSchema), proposal.list);
router.post("/", validate(createProposalSchema), proposal.create);
router.patch("/:id", validate(updateProposalSchema), proposal.update);
router.post("/:id/submit", validate(proposalIdSchema), proposal.submit);
router.post("/:id/accept", validate(proposalIdSchema), proposal.action("accept"));
router.post("/:id/counter", validate(counterProposalSchema), proposal.action("counter"));
router.post("/:id/decline", validate(proposalIdSchema), proposal.action("decline"));
router.post("/:id/cancel", validate(proposalIdSchema), proposal.action("cancel"));
export default router;
