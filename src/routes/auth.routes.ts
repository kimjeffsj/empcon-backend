import { Router } from "express";
import { AuthController } from "@/controllers/authController";
import { authenticateToken } from "@/middleware/auth.middleware";
import { validateBody } from "@/middleware/validation.middleware";
import { authRateLimitMiddleware } from "@/middleware/security.middleware";
import Joi from "joi";

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().min(8).required(),
});

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
