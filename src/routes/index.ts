import { Router } from "express";
import healthRoutes from "./health";

const router = Router();

router.use("/health", healthRoutes);

// API versioning
router.use("/v1", router);

export default router;
