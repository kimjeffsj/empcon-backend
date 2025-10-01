import { PrismaClient } from "@prisma/client";
import {
  Payslip,
  GeneratePayslipsRequest,
  GeneratePayslipsResponse,
  GetPayslipsParams,
  GetPayslipsResponse,
  UpdatePayslipRequest,
  PayslipSummary,
} from "@empcon/types";
import { PayrollCalculationService } from "./payrollCalculation.service";

const prisma = new PrismaClient();

export class PayslipService {
  /**
   * Generate payslips for a pay period
   */
  static async generatePayslips(request: GeneratePayslipsRequest): Promise<GeneratePayslipsResponse> {
    const { payPeriodId, employeeIds, recalculate = false } = request;

    // Validate pay period
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId }
    });

    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    if (payPeriod.status === 'PAID') {
      throw new Error('Cannot generate payslips for a paid period');
    }

    // Check for existing payslips
    if (!recalculate) {
      const existingPayslips = await prisma.payslip.count({
        where: {
          payPeriodId,
          ...(employeeIds && { employeeId: { in: employeeIds } })
        }
      });

      if (existingPayslips > 0) {
        throw new Error(
          `Payslips already exist for this period. Use recalculate=true to regenerate.`
        );
      }
    }

    // Calculate payroll for the period
    const payrollCalculation = await PayrollCalculationService.calculateBatchPayroll(
      payPeriodId,
      employeeIds
    );

    if (payrollCalculation.employees.length === 0) {
      throw new Error('No employees eligible for payroll generation');
    }

    // Generate payslips
    const payslips: Payslip[] = [];

    for (const employeeCalculation of payrollCalculation.employees) {
      try {
        // Delete existing payslip if recalculating
        if (recalculate) {
          await prisma.payslip.deleteMany({
            where: {
              employeeId: employeeCalculation.employeeId,
              payPeriodId
            }
          });
        }

        // Create new payslip
        const payslip = await prisma.payslip.create({
          data: {
            employeeId: employeeCalculation.employeeId,
            payPeriodId,
            regularHours: employeeCalculation.regularHours,
            overtimeHours: employeeCalculation.overtimeHours,
            grossPay: employeeCalculation.grossPay,
            deductions: employeeCalculation.deductions,
            netPay: employeeCalculation.netPay
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                payRate: true,
                payType: true
              }
            },
            payPeriod: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                payDate: true,
                status: true
              }
            }
          }
        });

        payslips.push(this.formatPayslipResponse(payslip));
      } catch (error) {
        console.error(`Error generating payslip for employee ${employeeCalculation.employeeId}:`, error);
        // Continue with other employees
      }
    }

    // Update pay period status to PROCESSING
    await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: { status: 'PROCESSING' }
    });

    // Calculate summary
    const summary = {
      totalEmployees: payslips.length,
      totalGrossPay: payslips.reduce((sum, p) => sum + p.grossPay, 0),
      totalDeductions: payslips.reduce((sum, p) => sum + p.deductions, 0),
      totalNetPay: payslips.reduce((sum, p) => sum + p.netPay, 0),
      averageHours: payslips.reduce((sum, p) => sum + p.regularHours + p.overtimeHours, 0) / payslips.length
    };

    return {
      payslips,
      summary,
      message: `Successfully generated ${payslips.length} payslips for pay period`
    };
  }

  /**
   * Get payslips with filtering and pagination
   */
  static async getPayslips(params: GetPayslipsParams): Promise<GetPayslipsResponse> {
    const { employeeId, payPeriodId, startDate, endDate, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (payPeriodId) {
      where.payPeriodId = payPeriodId;
    }

    // Date filtering through pay period
    if (startDate || endDate) {
      where.payPeriod = {};

      if (startDate) {
        where.payPeriod.startDate = { gte: new Date(startDate) };
      }

      if (endDate) {
        where.payPeriod.endDate = { lte: new Date(endDate) };
      }
    }

    // Get payslips with pagination
    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              payRate: true,
              payType: true
            }
          },
          payPeriod: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              payDate: true,
              status: true
            }
          }
        }
      }),
      prisma.payslip.count({ where })
    ]);

    const formattedPayslips = payslips.map(this.formatPayslipResponse);

    return {
      data: formattedPayslips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single payslip by ID
   */
  static async getPayslipById(id: string): Promise<Payslip> {
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            payRate: true,
            payType: true
          }
        },
        payPeriod: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            payDate: true,
            status: true
          }
        }
      }
    });

    if (!payslip) {
      throw new Error('Payslip not found');
    }

    return this.formatPayslipResponse(payslip);
  }

  /**
   * Update payslip (limited fields for admin adjustments)
   */
  static async updatePayslip(id: string, request: UpdatePayslipRequest): Promise<Payslip> {
    const { deductions, notes } = request;

    // Check if payslip exists
    const existingPayslip = await prisma.payslip.findUnique({
      where: { id }
    });

    if (!existingPayslip) {
      throw new Error('Payslip not found');
    }

    // Build update data
    const updateData: any = {};

    if (deductions !== undefined) {
      updateData.deductions = deductions;
      // Recalculate net pay
      updateData.netPay = Number(existingPayslip.grossPay) - deductions;
    }

    // Note: notes field would need to be added to schema for this to work
    // Keeping it here for future enhancement

    // Update payslip
    const updatedPayslip = await prisma.payslip.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            payRate: true,
            payType: true
          }
        },
        payPeriod: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            payDate: true,
            status: true
          }
        }
      }
    });

    return this.formatPayslipResponse(updatedPayslip);
  }

  /**
   * Delete payslip (only if pay period is not PAID)
   */
  static async deletePayslip(id: string): Promise<void> {
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        payPeriod: {
          select: { status: true }
        }
      }
    });

    if (!payslip) {
      throw new Error('Payslip not found');
    }

    if (payslip.payPeriod.status === 'PAID') {
      throw new Error('Cannot delete payslip from a paid period');
    }

    await prisma.payslip.delete({
      where: { id }
    });
  }

  /**
   * Get payslip summary for an employee
   */
  static async getEmployeePayslipSummary(employeeId: string, year?: number): Promise<PayslipSummary[]> {
    const currentYear = year || new Date().getFullYear();

    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId,
        payPeriod: {
          startDate: {
            gte: new Date(currentYear, 0, 1),
            lte: new Date(currentYear, 11, 31)
          }
        }
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true
          }
        },
        payPeriod: {
          select: {
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: {
        payPeriod: {
          startDate: 'asc'
        }
      }
    });

    return payslips.map(payslip => {
      // Generate period string
      const startDate = new Date(payslip.payPeriod.startDate);
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const period = startDate.getDate() === 1 ? 'A' : 'B';
      const periodString = `${year}-${month}-${period}`;

      return {
        employeeId: payslip.employeeId,
        employeeName: `${payslip.employee.firstName || ''} ${payslip.employee.lastName || ''}`.trim(),
        employeeNumber: payslip.employee.employeeNumber || undefined,
        regularHours: Number(payslip.regularHours),
        overtimeHours: Number(payslip.overtimeHours),
        totalHours: Number(payslip.regularHours) + Number(payslip.overtimeHours),
        grossPay: Number(payslip.grossPay),
        deductions: Number(payslip.deductions),
        netPay: Number(payslip.netPay),
        payPeriod: periodString
      };
    });
  }

  /**
   * Get payroll summary for all employees by pay period
   */
  static async getPayrollSummaryByPeriod(payPeriodId: string): Promise<PayslipSummary[]> {
    const payslips = await prisma.payslip.findMany({
      where: { payPeriodId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true
          }
        },
        payPeriod: {
          select: {
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: {
        employee: {
          lastName: 'asc'
        }
      }
    });

    return payslips.map(payslip => {
      // Generate period string
      const startDate = new Date(payslip.payPeriod.startDate);
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const period = startDate.getDate() === 1 ? 'A' : 'B';
      const periodString = `${year}-${month}-${period}`;

      return {
        employeeId: payslip.employeeId,
        employeeName: `${payslip.employee.firstName || ''} ${payslip.employee.lastName || ''}`.trim(),
        employeeNumber: payslip.employee.employeeNumber || undefined,
        regularHours: Number(payslip.regularHours),
        overtimeHours: Number(payslip.overtimeHours),
        totalHours: Number(payslip.regularHours) + Number(payslip.overtimeHours),
        grossPay: Number(payslip.grossPay),
        deductions: Number(payslip.deductions),
        netPay: Number(payslip.netPay),
        payPeriod: periodString
      };
    });
  }

  /**
   * Mark pay period as paid (finalizes all payslips)
   */
  static async markPayPeriodAsPaid(payPeriodId: string): Promise<{ message: string; payslipsCount: number }> {
    // Check if pay period exists and has payslips
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        _count: {
          select: { payslips: true }
        }
      }
    });

    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    if (payPeriod._count.payslips === 0) {
      throw new Error('Cannot mark pay period as paid - no payslips exist');
    }

    if (payPeriod.status === 'PAID') {
      throw new Error('Pay period is already marked as paid');
    }

    // Update pay period status
    await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: { status: 'PAID' }
    });

    return {
      message: 'Pay period marked as paid successfully',
      payslipsCount: payPeriod._count.payslips
    };
  }

  /**
   * Format Payslip for API response
   */
  static formatPayslipResponse(payslip: any): Payslip {
    return {
      id: payslip.id,
      employeeId: payslip.employeeId,
      payPeriodId: payslip.payPeriodId,
      regularHours: Number(payslip.regularHours),
      overtimeHours: Number(payslip.overtimeHours),
      grossPay: Number(payslip.grossPay),
      deductions: Number(payslip.deductions),
      netPay: Number(payslip.netPay),
      filePath: payslip.filePath || undefined,
      createdAt: payslip.createdAt.toISOString(),
      updatedAt: payslip.updatedAt.toISOString(),
      employee: payslip.employee ? {
        id: payslip.employee.id,
        firstName: payslip.employee.firstName || undefined,
        lastName: payslip.employee.lastName || undefined,
        employeeNumber: payslip.employee.employeeNumber || undefined,
        payRate: payslip.employee.payRate ? Number(payslip.employee.payRate) : undefined,
        payType: payslip.employee.payType || undefined
      } : undefined,
      payPeriod: payslip.payPeriod ? {
        id: payslip.payPeriod.id,
        startDate: payslip.payPeriod.startDate.toISOString(),
        endDate: payslip.payPeriod.endDate.toISOString(),
        payDate: payslip.payPeriod.payDate.toISOString(),
        status: payslip.payPeriod.status
      } : undefined
    };
  }

  /**
   * Bulk upload payslip files from accountant
   * Creates new Payslip records with only filePath (calculation fields are null)
   * Filename format: "Sep A - John Doe.pdf"
   */
  static async bulkUploadPayslipFiles(
    payPeriodId: string,
    files: Express.Multer.File[]
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        // Parse filename: "Sep A - John Doe.pdf" → "John Doe"
        const fileName = file.originalname;
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
        const parts = nameWithoutExt.split(' - '); // Split by " - "

        if (parts.length < 2) {
          errors.push(`Invalid filename format: ${fileName}. Expected: "Period - First Last.pdf"`);
          failedCount++;
          continue;
        }

        const fullName = parts[1].trim(); // "John Doe"
        const nameParts = fullName.split(' '); // ["John", "Doe"]

        if (nameParts.length < 2) {
          errors.push(`Invalid name format in ${fileName}. Expected: "First Last"`);
          failedCount++;
          continue;
        }

        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' '); // Supports multiple last names

        // Find employee by name (case-insensitive)
        const employee = await prisma.user.findFirst({
          where: {
            firstName: { equals: firstName, mode: 'insensitive' },
            lastName: { equals: lastName, mode: 'insensitive' },
            role: 'EMPLOYEE'
          }
        });

        if (!employee) {
          errors.push(`Employee not found: ${firstName} ${lastName} (from ${fileName})`);
          failedCount++;
          continue;
        }

        // Check if Payslip already exists
        const existingPayslip = await prisma.payslip.findFirst({
          where: {
            employeeId: employee.id,
            payPeriodId
          }
        });

        const filePath = `/uploads/payslips/${file.filename}`;

        if (existingPayslip) {
          // Update existing Payslip with filePath
          await prisma.payslip.update({
            where: { id: existingPayslip.id },
            data: { filePath }
          });
        } else {
          // Create new Payslip with only filePath (calculation fields are null)
          await prisma.payslip.create({
            data: {
              employeeId: employee.id,
              payPeriodId,
              filePath,
              // regularHours, overtimeHours, grossPay, deductions, netPay are null
            }
          });
        }

        successCount++;
      } catch (error: any) {
        errors.push(`Failed to process ${file.originalname}: ${error.message}`);
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors
    };
  }
}