import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { config } from "./config/env.config";
import { corsMiddleware } from "./middleware/cors.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";
import {
  securityMiddleware,
  rateLimitMiddleware,
} from "./middleware/security.middleware";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.middleware";
import routes from "./routes";

const app = express();

// Cookie parsing middleware
app.use(cookieParser());

// Security middleware
app.use(securityMiddleware);
app.use(rateLimitMiddleware);

// CORS middleware
app.use(corsMiddleware);

// Logging middleware
app.use(loggerMiddleware);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Trust proxy (for rate limiting and logging)
app.set("trust proxy", 1);

// API routes
app.use("/api", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Employee Management System API",
    version: "1.0.0",
    docs: "/api/docs",
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`
  🚀 Server is running on port ${PORT}
  📝 Environment: ${config.nodeEnv}
  🌐 API Base URL: http://localhost:${PORT}/api
  💾 Database: Connected
    `);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    console.log("HTTP server closed.");

    try {
      // Close database connection
      const { default: prisma } = await import("./config/database.config");
      await prisma.$disconnect();
      console.log("Database connection closed.");
    } catch (error) {
      console.error("Error closing database connection:", error);
    }

    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
