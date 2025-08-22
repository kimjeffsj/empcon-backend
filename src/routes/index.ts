import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import employeeRoutes from "./employee.routes";
import departmentRoutes from "./department.routes";
import positionRoutes from "./position.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/employees", employeeRoutes);
router.use("/departments", departmentRoutes);
router.use("/positions", positionRoutes);

export default router;
