import { Router } from "express";
import * as auth from "../controllers/authController.js";
import { validate } from "../middlewares/validate.js";
import { verifyRefreshTokenMiddleware } from "../middlewares/auth.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/auth.js";
import { protect } from "../middlewares/auth.js";
import { authLimiter } from "../middlewares/rateLimits.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), auth.register);
router.post("/login", authLimiter, validate(loginSchema), auth.login);
router.post("/refresh", verifyRefreshTokenMiddleware, auth.refresh);
router.post("/logout", auth.logout);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), auth.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), auth.resetPassword);
router.patch("/change-password", authLimiter, protect, validate(changePasswordSchema), auth.changePassword);

export default router;
