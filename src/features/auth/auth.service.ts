import prisma from "@/config/database.config";
import { generateTokens, verifyRefreshToken } from "@/utils/jwt.utils";
import { AppError } from "@/middleware/errorHandler.middleware";
import {
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
  UserRole,
} from "@empcon/types";
import { PasswordUtils } from "@/utils/password.utils";
import { EmailService } from "@/services/email/emailService";

export class AuthService {
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { email, password } = credentials;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new AppError("Account is temporarily locked", 423);
    }

    // Verify password
    const isPasswordValid = await PasswordUtils.validatePassword(
      password,
      user.passwordHash
    );

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
        firstName: user.firstName || "",
        lastName: user.lastName || "",
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

    // Validate new password strength
    const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new AppError(
        `Password validation failed: ${passwordValidation.errors.join(", ")}`,
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Verify current password using PasswordUtils for consistency
    const isCurrentPasswordValid = await PasswordUtils.validatePassword(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    // Hash new password
    const hashedNewPassword = await PasswordUtils.hashPassword(newPassword);

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

  static async createUser(userData: {
    email: string;
    password: string;
    role: UserRole;
  }): Promise<void> {
    const { email, password, role } = userData;

    // Password validation
    const passwordValidation = PasswordUtils.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new AppError(
        `Password validation failed: ${passwordValidation.errors.join(", ")}`,
        400
      );
    }
    // Email validation
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    // Hash Password
    const hashedPassword = await PasswordUtils.hashPassword(password);

    // Create User
    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        role,
        status: "ACTIVE",
      },
    });
  }

  static async generateTempPassword(userId: string): Promise<string> {
    const tempPassword = PasswordUtils.generateTempPassword();
    const hashedTempPassword = await PasswordUtils.hashPassword(tempPassword);

    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        tempPasswordHash: hashedTempPassword,
        tempPasswordExpiresAt: expiresAt,
        passwordResetRequired: true,
      },
    });

    return tempPassword; // for email
  }

  static async generateAndSendTempPassword(
    userId: string,
    userEmail: string,
    employeeName: string
  ): Promise<string> {
    // Generate temporary password
    const tempPassword = await this.generateTempPassword(userId);

    // Send email with temporary password
    await EmailService.sendTempPasswordEmail({
      email: userEmail,
      tempPassword,
      employeeName,
    });

    return tempPassword;
  }
}
