import { Router, Request, Response } from "express";
import prisma from "../config/database";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Server is unhealthy",
      error: "Database connection failed",
    });
  }
});

export default router;
