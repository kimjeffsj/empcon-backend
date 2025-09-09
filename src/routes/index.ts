import { Router } from "express";
import healthRoutes from "../features/health/health.routes";
import authRoutes from "../features/auth/auth.routes";
import employeeRoutes from "../features/employee/employee.routes";
import departmentRoutes from "../features/department/department.routes";
import positionRoutes from "../features/position/position.routes";
import scheduleRoutes from "../features/schedule/schedule.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/employees", employeeRoutes);
router.use("/departments", departmentRoutes);
router.use("/positions", positionRoutes);
router.use("/schedules", scheduleRoutes);

export default router;
