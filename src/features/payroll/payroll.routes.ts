import { Router } from "express";
import multer from "multer";
import path from "path";
import { payrollController } from "./payroll.controller";
import { authMiddleware, requireManager, requireAdmin } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  CreatePayPeriodSchema,
  UpdatePayPeriodSchema,
  GetPayPeriodsParamsSchema,
  GetPayslipsParamsSchema,
  UpdatePayslipSchema,
  PayPeriodIdParamSchema,
  PayslipIdParamSchema,
  EmployeePayrollParamsSchema,
  PayrollSummaryQuerySchema,
  GenerateExcelReportSchema,
  SendToAccountantSchema,
} from "@empcon/types";

const router = Router();

// ============= MULTER CONFIGURATION =============

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/payslips/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

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

// Note: Payslip generation happens via bulk upload from accountant
// POST /payslips/generate endpoint removed - not needed in current workflow
// Workflow: Calculate → Excel Report → Email → Accountant PDFs → Bulk Upload

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

// ============= REPORTS & EMAIL INTEGRATION ROUTES =============

// POST /api/payroll/reports/generate - Generate Excel payroll report (Manager only)
router.post(
  "/reports/generate",
  requireManager,
  validateRequest(GenerateExcelReportSchema),
  payrollController.generatePayrollReport
);

// POST /api/payroll/email/send-to-accountant - Send payroll report to accountant (Manager only)
router.post(
  "/email/send-to-accountant",
  requireManager,
  validateRequest(SendToAccountantSchema),
  payrollController.sendPayrollToAccountant
);

// ============= PAYSLIP FILE MANAGEMENT ROUTES =============

// POST /api/payroll/periods/:payPeriodId/upload-bulk - Bulk upload payslip files (Manager only)
router.post(
  "/periods/:payPeriodId/upload-bulk",
  requireManager,
  upload.array("payslips", 50), // Max 50 files
  payrollController.bulkUploadPayslipFiles
);

// GET /api/payroll/payslips/:id/download - Download payslip file
router.get(
  "/payslips/:id/download",
  validateRequest(PayslipIdParamSchema, "params"),
  payrollController.downloadPayslipFile
);

export default router;
