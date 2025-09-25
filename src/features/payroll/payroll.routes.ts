import { Router } from "express";
import { payrollController } from "./payroll.controller";
import { authMiddleware, requireManager, requireAdmin } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  CreatePayPeriodSchema,
  UpdatePayPeriodSchema,
  GetPayPeriodsParamsSchema,
  GeneratePayslipsSchema,
  GetPayslipsParamsSchema,
  UpdatePayslipSchema,
  PayPeriodIdParamSchema,
  PayslipIdParamSchema,
  EmployeePayrollParamsSchema,
  PayrollSummaryQuerySchema,
} from "@empcon/types";

const router = Router();

// All payroll routes require authentication
router.use(authMiddleware);

// ============= PAY PERIOD ROUTES =============

// POST /api/payroll/periods - Create new pay period (Admin only)
router.post(
  "/periods",
  requireManager,
  validateRequest(CreatePayPeriodSchema),
  payrollController.createPayPeriod
);

// GET /api/payroll/periods - Get pay periods with filtering
router.get(
  "/periods",
  validateRequest(GetPayPeriodsParamsSchema, 'query'),
  payrollController.getPayPeriods
);

// GET /api/payroll/periods/current - Get current pay period info
router.get("/periods/current", payrollController.getCurrentPayPeriod);

// GET /api/payroll/periods/can-generate - Check if completed period can be generated (Manager only)
router.get(
  "/periods/can-generate",
  requireManager,
  payrollController.canGenerateCompletedPeriod
);

// POST /api/payroll/periods/generate-upcoming - Generate upcoming pay periods (Admin only)
router.post(
  "/periods/generate-upcoming",
  requireManager,
  payrollController.generateUpcomingPeriods
);

// POST /api/payroll/periods/generate-completed-period - Auto-generate completed period (Manager only)
router.post(
  "/periods/generate-completed-period",
  requireManager,
  payrollController.generateCompletedPeriod
);

// GET /api/payroll/periods/:id - Get pay period by ID
router.get(
  "/periods/:id",
  validateRequest(PayPeriodIdParamSchema, 'params'),
  payrollController.getPayPeriodById
);

// PUT /api/payroll/periods/:id - Update pay period (Admin only)
router.put(
  "/periods/:id",
  requireManager,
  validateRequest(PayPeriodIdParamSchema, 'params'),
  validateRequest(UpdatePayPeriodSchema),
  payrollController.updatePayPeriod
);

// DELETE /api/payroll/periods/:id - Delete pay period (Admin only)
router.delete(
  "/periods/:id",
  requireAdmin,
  validateRequest(PayPeriodIdParamSchema, 'params'),
  payrollController.deletePayPeriod
);

// ============= PAYROLL CALCULATION ROUTES =============

// POST /api/payroll/calculate/:payPeriodId - Calculate payroll for pay period (Admin only)
router.post(
  "/calculate/:payPeriodId",
  requireManager,
  validateRequest(PayPeriodIdParamSchema, 'params'),
  payrollController.calculatePayroll
);

// POST /api/payroll/validate/:payPeriodId - Validate payroll calculation (Admin only)
router.post(
  "/validate/:payPeriodId",
  requireManager,
  validateRequest(PayPeriodIdParamSchema, 'params'),
  payrollController.validatePayroll
);

// GET /api/payroll/employee/:employeeId/summary - Get employee payroll summary
// Employees can only view their own data, admins can view any employee
router.get(
  "/employee/:employeeId/summary",
  validateRequest(EmployeePayrollParamsSchema, 'params'),
  payrollController.getEmployeePayrollSummary
);

// ============= PAYSLIP ROUTES =============

// POST /api/payroll/payslips/generate - Generate payslips for pay period (Admin only)
router.post(
  "/payslips/generate",
  requireManager,
  validateRequest(GeneratePayslipsSchema),
  payrollController.generatePayslips
);

// GET /api/payroll/payslips - Get payslips with filtering
// Employees can only view their own payslips
router.get(
  "/payslips",
  validateRequest(GetPayslipsParamsSchema, 'query'),
  payrollController.getPayslips
);

// GET /api/payroll/payslips/:id - Get payslip by ID
// Employees can only view their own payslips
router.get(
  "/payslips/:id",
  validateRequest(PayslipIdParamSchema, 'params'),
  payrollController.getPayslipById
);

// PUT /api/payroll/payslips/:id - Update payslip (Admin only)
router.put(
  "/payslips/:id",
  requireManager,
  validateRequest(PayslipIdParamSchema, 'params'),
  validateRequest(UpdatePayslipSchema),
  payrollController.updatePayslip
);

// DELETE /api/payroll/payslips/:id - Delete payslip (Admin only)
router.delete(
  "/payslips/:id",
  requireAdmin,
  validateRequest(PayslipIdParamSchema, 'params'),
  payrollController.deletePayslip
);

// ============= SUMMARY & REPORTING ROUTES =============

// GET /api/payroll/employee/:employeeId/payslips - Get employee payslip summary
// Employees can only view their own data
router.get(
  "/employee/:employeeId/payslips",
  validateRequest(EmployeePayrollParamsSchema, 'params'),
  validateRequest(PayrollSummaryQuerySchema, 'query'),
  payrollController.getEmployeePayslips
);

// GET /api/payroll/periods/:payPeriodId/summary - Get payroll summary for pay period
router.get(
  "/periods/:payPeriodId/summary",
  validateRequest(PayPeriodIdParamSchema, 'params'),
  payrollController.getPayPeriodSummary
);

// POST /api/payroll/periods/:payPeriodId/mark-paid - Mark pay period as paid (Admin only)
router.post(
  "/periods/:payPeriodId/mark-paid",
  requireManager,
  validateRequest(PayPeriodIdParamSchema, 'params'),
  payrollController.markPayPeriodAsPaid
);

export default router;
