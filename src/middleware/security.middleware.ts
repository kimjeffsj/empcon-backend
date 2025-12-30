import helmet from "helmet";
import rateLimit from "express-rate-limit";

export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

// General rate limiting (100 requests per 15 minutes)
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiting (15 requests per 15 minutes)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs for auth endpoints
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Environment-based activation
const isDevelopment = process.env.NODE_ENV === "development";

// Export middleware based on environment
// Development: Rate limiting disabled for easier testing
// Production: Rate limiting enabled for security
export const rateLimitMiddleware = isDevelopment
  ? (_req: any, _res: any, next: any) => next()
  : generalRateLimiter;

export const authRateLimitMiddleware = isDevelopment
  ? (_req: any, _res: any, next: any) => next()
  : authRateLimiter;
