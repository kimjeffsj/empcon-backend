import { Request, Response } from "express";
import { PayPeriodService } from "./payPeriod.service";
import { PayslipService } from "./payslip.service";
import { PayrollCalculationService } from "./payrollCalculation.service";
import { ExcelReportService } from "./excelReport.service";
import { EmailService } from "./emailService.service";
import { catchAsync } from "../../middleware/errorHandler.middleware";
import {
  ApiResponse,
  CreatePayPeriodRequest,
  UpdatePayPeriodRequest,
  UpdatePayslipRequest,
} from "@empcon/types";

export const payrollController = {
  // ============= PAY PERIOD ENDPOINTS =============

  // POST /api/payroll/periods - Create new pay period
  createPayPeriod: catchAsync(async (req: Request, res: Response) => {
    const request: CreatePayPeriodRequest = req.body;
    const result = await PayPeriodService.createPayPeriod(request);

    const response: ApiResponse<typeof result> = {
      success: true,
      message: result.message,
      data: result,
    };

    res.status(201).json(response);
  }),

  // GET /api/payroll/periods - Get pay periods with filtering
  getPayPeriods: catchAsync(async (req: Request, res: Response) => {
    const params = req.query;
    const result = await PayPeriodService.getPayPeriods(params);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // GET /api/payroll/periods/current - Get current pay period info
  getCurrentPayPeriod: catchAsync(async (_req: Request, res: Response) => {
    const result = await PayPeriodService.getCurrentPayPeriod();

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // GET /api/payroll/periods/:id - Get pay period by ID
  getPayPeriodById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const payPeriod = await PayPeriodService.getPayPeriodSummary(id);

    const response: ApiResponse<typeof payPeriod> = {
      success: true,
      data: payPeriod,
    };

    res.json(response);
  }),

  // PUT /api/payroll/periods/:id - Update pay period
  updatePayPeriod: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const request: UpdatePayPeriodRequest = req.body;
    const payPeriod = await PayPeriodService.updatePayPeriod(id, request);

    const response: ApiResponse<typeof payPeriod> = {
      success: true,
      message: "Pay period updated successfully",
      data: payPeriod,
    };

    res.json(response);
  }),

  // DELETE /api/payroll/periods/:id - Delete pay period
  deletePayPeriod: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await PayPeriodService.deletePayPeriod(id);

    const response: ApiResponse<null> = {
      success: true,
      message: "Pay period deleted successfully",
      data: null,
    };

    res.json(response);
  }),

  // ============= PAYROLL CALCULATION ENDPOINTS =============

  // POST /api/payroll/calculate/:payPeriodId - Calculate payroll for pay period
  calculatePayroll: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId } = req.params;
    const { employeeIds } = req.body;

    const result = await PayrollCalculationService.calculateBatchPayroll(
      payPeriodId,
      employeeIds
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      message: "Payroll calculated successfully",
      data: result,
    };

    res.json(response);
  }),

  // GET /api/payroll/employee/:employeeId/summary - Get employee payroll summary
  getEmployeePayrollSummary: catchAsync(async (req: Request, res: Response) => {
    const { employeeId } = req.params;
    const { payPeriodId } = req.query;

    // Permission check: employees can only view their own data
    if (req.user?.role === "EMPLOYEE" && req.user.userId !== employeeId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view this employee's payroll data",
      });
    }

    const result = await PayrollCalculationService.getEmployeePayrollSummary(
      employeeId,
      payPeriodId as string
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // POST /api/payroll/validate/:payPeriodId - Validate payroll calculation
  validatePayroll: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId } = req.params;
    const result = await PayrollCalculationService.validatePayrollCalculation(
      payPeriodId
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // ============= PAYSLIP ENDPOINTS =============

  // Note: Payslip generation removed - handled via bulk upload from accountant
  // Workflow: Calculate → Excel → Email → Accountant creates PDFs → Bulk Upload

  // GET /api/payroll/payslips - Get payslips with filtering
  getPayslips: catchAsync(async (req: Request, res: Response) => {
    const params = req.query;

    // Permission check: employees can only view their own payslips
    if (req.user?.role === "EMPLOYEE") {
      (params as any).employeeId = req.user.userId;
    }

    const result = await PayslipService.getPayslips(params);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // GET /api/payroll/payslips/:id - Get payslip by ID
  getPayslipById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const payslip = await PayslipService.getPayslipById(id);

    // Permission check: employees can only view their own payslips
    if (
      req.user?.role === "EMPLOYEE" &&
      req.user.userId !== payslip.employeeId
    ) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view this payslip",
      });
    }

    const response: ApiResponse<typeof payslip> = {
      success: true,
      data: payslip,
    };

    res.json(response);
  }),

  // PUT /api/payroll/payslips/:id - Update payslip (admin only)
  updatePayslip: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const request: UpdatePayslipRequest = req.body;
    const payslip = await PayslipService.updatePayslip(id, request);

    const response: ApiResponse<typeof payslip> = {
      success: true,
      message: "Payslip updated successfully",
      data: payslip,
    };

    res.json(response);
  }),

  // DELETE /api/payroll/payslips/:id - Delete payslip (admin only)
  deletePayslip: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await PayslipService.deletePayslip(id);

    const response: ApiResponse<null> = {
      success: true,
      message: "Payslip deleted successfully",
      data: null,
    };

    res.json(response);
  }),

  // ============= SUMMARY & REPORTING ENDPOINTS =============

  // GET /api/payroll/employee/:employeeId/payslips - Get employee payslip summary
  getEmployeePayslips: catchAsync(async (req: Request, res: Response) => {
    const { employeeId } = req.params;
    const { year } = req.query;

    // Permission check: employees can only view their own data
    if (req.user?.role === "EMPLOYEE" && req.user.userId !== employeeId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view this employee's payslips",
      });
    }

    const result = await PayslipService.getEmployeePayslipSummary(
      employeeId,
      year ? parseInt(year as string) : undefined
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // GET /api/payroll/periods/:payPeriodId/summary - Get payroll summary for pay period
  getPayPeriodSummary: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId } = req.params;
    const result = await PayslipService.getPayrollSummaryByPeriod(payPeriodId);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // POST /api/payroll/periods/:payPeriodId/mark-paid - Mark pay period as paid
  markPayPeriodAsPaid: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId } = req.params;
    const result = await PayslipService.markPayPeriodAsPaid(payPeriodId);

    const response: ApiResponse<typeof result> = {
      success: true,
      message: result.message,
      data: result,
    };

    res.json(response);
  }),

  // ============= UTILITY ENDPOINTS =============

  // POST /api/payroll/periods/generate-upcoming - Generate upcoming pay periods
  generateUpcomingPeriods: catchAsync(async (req: Request, res: Response) => {
    const { monthsAhead = 3 } = req.body;
    const result = await PayPeriodService.generateUpcomingPeriods(monthsAhead);

    const response: ApiResponse<typeof result> = {
      success: true,
      message: `Generated ${result.length} upcoming pay periods`,
      data: result,
    };

    res.json(response);
  }),

  // POST /api/payroll/periods/generate-completed-period - Auto-generate completed period
  generateCompletedPeriod: catchAsync(async (_req: Request, res: Response) => {
    const result = await PayPeriodService.createCompletedPeriodPayPeriod();

    const response: ApiResponse<typeof result> = {
      success: true,
      message: result.message,
      data: result,
    };

    res.status(201).json(response);
  }),

  // GET /api/payroll/periods/can-generate - Check if completed period can be generated
  canGenerateCompletedPeriod: catchAsync(async (_req: Request, res: Response) => {
    const result = PayPeriodService.canGenerateCompletedPeriod();

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // ============= REPORTS & EMAIL INTEGRATION =============

  // POST /api/payroll/reports/generate - Generate Excel payroll report
  generatePayrollReport: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId, format } = req.body;

    const excelBuffer = await ExcelReportService.generatePayrollReport({
      payPeriodId,
      format: format || 'excel'
    });

    // Get pay period info for filename
    const payPeriod = await PayPeriodService.getPayPeriodSummary(payPeriodId);
    // Parse period format "2024-01-A" -> year: 2024, month: 01, period: A
    const [year, month, periodType] = payPeriod.period.split('-');
    const filename = `Payroll_Report_${year}-${month}_Period${periodType}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', (excelBuffer as any).length);

    res.send(excelBuffer);
  }),

  // POST /api/payroll/email/send-to-accountant - Send payroll report to accountant
  sendPayrollToAccountant: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId, accountantEmail } = req.body;

    const emailLog = await EmailService.sendToAccountant({
      payPeriodId,
      accountantEmail
    });

    if (emailLog.success) {
      const response: ApiResponse<typeof emailLog> = {
        success: true,
        message: `Payroll report successfully sent to ${emailLog.recipientEmail}`,
        data: emailLog,
      };
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        error: `Email delivery failed: ${emailLog.error}`,
        data: emailLog
      });
    }
  }),

  // ============= PAYSLIP FILE MANAGEMENT ENDPOINTS =============

  // POST /api/payroll/periods/:payPeriodId/upload-bulk - Bulk upload payslip files (Manager only)
  bulkUploadPayslipFiles: catchAsync(async (req: Request, res: Response) => {
    const { payPeriodId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const result = await PayslipService.bulkUploadPayslipFiles(payPeriodId, files);

    const response: ApiResponse<typeof result> = {
      success: true,
      message: `Uploaded ${result.success} payslips successfully. ${result.failed} failed.`,
      data: result
    };

    res.json(response);
  }),

  // GET /api/payroll/payslips/:id/download - Download payslip file
  downloadPayslipFile: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const payslip = await PayslipService.getPayslipById(id);

    // Permission check: employees can only download their own payslips
    if (
      req.user?.role === 'EMPLOYEE' &&
      req.user.userId !== payslip.employeeId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to download this payslip'
      });
    }

    if (!payslip.filePath) {
      return res.status(404).json({
        success: false,
        error: 'Payslip file not available yet'
      });
    }

    // Build full file path
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(process.cwd(), payslip.filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'Payslip file does not exist on server'
      });
    }

    // Send file for download
    res.download(fullPath, path.basename(fullPath));
  }),
};
