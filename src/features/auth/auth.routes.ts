import { Router } from "express";
import { AuthController } from "@/features/auth/auth.controller";
import { authenticateToken } from "@/middleware/auth.middleware";
import { validateBody } from "@/middleware/validation.middleware";
import { authRateLimitMiddleware } from "@/middleware/security.middleware";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@empcon/types";

const router = Router();

// Public routes (with rate limiting)
router.post(
  "/login",
  authRateLimitMiddleware,
  validateBody(loginSchema),
  AuthController.login
);

router.post(
  "/refresh",
  authRateLimitMiddleware,
  validateBody(refreshTokenSchema),
  AuthController.refreshToken
);

router.post(
  "/register",
  authRateLimitMiddleware,
  validateBody(registerSchema),
  AuthController.register
);

router.post(
  "/forgot-password",
  authRateLimitMiddleware,
  validateBody(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  authRateLimitMiddleware,
  validateBody(resetPasswordSchema),
  AuthController.resetPassword
);

// Protected routes
router.use(authenticateToken);

router.get("/profile", AuthController.getProfile);
router.post("/logout", AuthController.logout);
router.put(
  "/change-password",
  validateBody(changePasswordSchema),
  AuthController.changePassword
);

export default router;
