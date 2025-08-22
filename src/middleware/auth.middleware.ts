import { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.middleware";
import { verifyAccessToken } from "@/utils/jwt.utils";
import { TokenPayload, UserRole } from "@empcon/types";

declare global {
  namespace Express {
    interface Request {
      user?: Omit<TokenPayload, "iat" | "exp">;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new AppError("Access token required", 401);
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        throw new AppError("Access token expired", 401);
      } else if (error.name === "JsonWebTokenError") {
        throw new AppError("Invalid access token", 401);
      }
    }
    throw new AppError("Token verification failed", 401);
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    next();
  };
};

export const requireAdmin = requireRole(["ADMIN"]);
export const requireManager = requireRole(["ADMIN", "MANAGER"]);
export const requireAuthenticated = requireRole([
  "ADMIN",
  "MANAGER",
  "EMPLOYEE",
]);

// Alias for backward compatibility
export const authMiddleware = authenticateToken;
