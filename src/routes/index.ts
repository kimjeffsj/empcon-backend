import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

export default router;
