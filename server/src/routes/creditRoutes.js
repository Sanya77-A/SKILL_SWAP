import { Router } from "express";
import * as credit from "../controllers/creditController.js";
import { protect } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { adminAdjustmentSchema, listTransactionsSchema } from "../validators/credit.js";

const router = Router();
router.use(protect);
router.get("/wallet", credit.getWallet);
router.get("/transactions", validate(listTransactionsSchema), credit.listTransactions);
router.post("/admin-adjustments", adminOnly, validate(adminAdjustmentSchema), credit.adminAdjustment);

export default router;
