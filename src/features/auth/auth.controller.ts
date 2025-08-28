import { Request, Response, NextFunction } from "express";
import { AuthService } from "@/features/auth/auth.service";
import { AppError } from "@/middleware/errorHandler.middleware";
import { config } from "@/config/env.config";

import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
} from "@empcon/types";

// Cookie configuration constants
const getCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: "strict" as const,
  maxAge,
  path: "/",
});

const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: "strict" as const,
  path: "/",
});

const accessTokenOptions = getCookieOptions(15 * 60 * 1000); // 15 minutes
const refreshTokenOptions = getCookieOptions(7 * 24 * 60 * 60 * 1000); // 7 days
const clearCookieOptions = getClearCookieOptions();

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const loginData: LoginRequest = req.body;

      if (!loginData.email || !loginData.password) {
        throw new AppError("Email and password are required", 400);
      }

      const result = await AuthService.login(loginData);

      // Set httpOnly cookies
      res.cookie("accessToken", result.token, accessTokenOptions);
      res.cookie("refreshToken", result.refreshToken, refreshTokenOptions);

      // Return user data without tokens
      const response: ApiResponse<
        Omit<LoginResponse, "token" | "refreshToken">
      > = {
        success: true,
        message: "Login successful",
        data: {
          user: result.user,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      // Try to get refresh token from cookies first, then from body for backward compatibility
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
      }

      const tokens = await AuthService.refreshToken(refreshToken);

      // Set new httpOnly cookies
      res.cookie("accessToken", tokens.accessToken, accessTokenOptions);
      res.cookie("refreshToken", tokens.refreshToken, refreshTokenOptions);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {}, // No tokens returned in response body
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const passwordData: PasswordChangeRequest = req.body;
      const userId = req.user!.userId;

      if (
        !passwordData.currentPassword ||
        !passwordData.newPassword ||
        !passwordData.confirmPassword
      ) {
        throw new AppError("All password fields are required", 400);
      }

      await AuthService.changePassword(userId, passwordData);

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;

      await AuthService.logout(userId);

      // Clear cookies with same options used when setting them
      res.clearCookie("accessToken", clearCookieOptions);
      res.clearCookie("refreshToken", clearCookieOptions);

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, role = "EMPLOYEE" } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      await AuthService.createUser({ email, password, role });

      res.status(201).json({
        success: true,
        message: "User created successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}
