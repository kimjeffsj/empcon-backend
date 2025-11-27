import { Router } from "express";
import express from "express";
import healthRoutes from "../features/health/health.routes";
import authRoutes from "../features/auth/auth.routes";
import employeeRoutes from "../features/employee/employee.routes";
import departmentRoutes from "../features/department/department.routes";
import positionRoutes from "../features/position/position.routes";
import scheduleRoutes from "../features/schedule/schedule.routes";
import timeClockRoutes from "../features/timeclock/timeClock.routes";
import payrollRoutes from "../features/payroll/payroll.routes";

const router = Router();

// Body parsing middleware
const jsonParser = express.json({ limit: "10mb" });
const urlencodedParser = express.urlencoded({ extended: true, limit: "10mb" });

// Apply body-parser to all routes
router.use("/health", jsonParser, urlencodedParser, healthRoutes);
router.use("/auth", jsonParser, urlencodedParser, authRoutes);
router.use("/employees", jsonParser, urlencodedParser, employeeRoutes);
router.use("/departments", jsonParser, urlencodedParser, departmentRoutes);
router.use("/positions", jsonParser, urlencodedParser, positionRoutes);
router.use("/schedules", jsonParser, urlencodedParser, scheduleRoutes);
router.use("/timeclock", jsonParser, urlencodedParser, timeClockRoutes);

// Payroll routes: body-parser will be selectively applied inside payroll.routes.ts
router.use("/payroll", payrollRoutes);

export default router;
