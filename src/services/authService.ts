import bcrypt from "bcryptjs";
import prisma from "@/config/database.config";
import { generateTokens, verifyRefreshToken } from "@/utils/jwt.utils";
import { AppError } from "@/middleware/errorHandler.middleware";
import {
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
  UserRole,
} from "@empcon/types";

export class AuthService {
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { email, password } = credentials;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        employeeProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new AppError("Account is temporarily locked", 423);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          // Lock account after 5 failed attempts for 15 minutes
          accountLockedUntil:
            user.failedLoginAttempts >= 4
              ? new Date(Date.now() + 15 * 60 * 1000)
              : undefined,
        },
      });

      throw new AppError("Invalid credentials", 401);
    }

    // Check if user is active
    if (user.status !== "ACTIVE") {
      throw new AppError("Account is not active", 403);
    }

    // Reset failed login attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        firstName: user.employeeProfile?.firstName || "",
        lastName: user.employeeProfile?.lastName || "",
      },
      token: accessToken,
      refreshToken,
    };
  }

  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.status !== "ACTIVE") {
        throw new AppError("Invalid refresh token", 401);
      }

      // Generate new tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
      });

      return tokens;
    } catch (error) {
      throw new AppError("Invalid refresh token", 401);
    }
  }

  static async changePassword(
    userId: string,
    passwordData: PasswordChangeRequest
  ): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    // Validate that new password and confirm password match
    if (newPassword !== confirmPassword) {
      throw new AppError("New password and confirm password do not match", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear temporary password fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedNewPassword,
        tempPasswordHash: null,
        tempPasswordExpiresAt: null,
        passwordResetRequired: false,
      },
    });
  }

  static async logout(userId: string): Promise<void> {
    // Update last login (optional: could track logout time)
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLogin: new Date(),
      },
    });
  }
}
