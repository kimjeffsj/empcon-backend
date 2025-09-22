import { PrismaClient } from "@prisma/client";
import {
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollBatchCalculation,
  EmployeePayrollSummary,
  TimeEntryForPayroll,
  DEFAULT_OVERTIME_RULES,
  DEFAULT_DEDUCTION_RATES,
} from "@empcon/types";

const prisma = new PrismaClient();

export class PayrollCalculationService {
  /**
   * Calculate payroll for a single employee for a pay period
   */
  static async calculateEmployeePayroll(input: PayrollCalculationInput): Promise<PayrollCalculationResult> {
    const { employeeId, payPeriodId, payRate, payType } = input;

    // Get pay period details
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId }
    });

    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    // Get all time entries for this employee in the pay period
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        clockOutTime: { not: null }, // Only completed time entries
        schedule: {
          startTime: {
            gte: payPeriod.startDate,
            lte: payPeriod.endDate
          }
        }
      },
      include: {
        schedule: {
          select: {
            startTime: true,
            endTime: true
          }
        }
      },
      orderBy: { clockInTime: 'asc' }
    });

    // Calculate total hours
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;

    const timeEntriesDetails: TimeEntryForPayroll[] = timeEntries.map(entry => {
      const regularHours = entry.totalHours ? Number(entry.totalHours) : 0;
      const overtimeHours = entry.overtimeHours ? Number(entry.overtimeHours) : 0;

      totalRegularHours += regularHours - overtimeHours; // Regular hours = total - overtime
      totalOvertimeHours += overtimeHours;

      return {
        id: entry.id,
        clockInTime: entry.clockInTime.toISOString(),
        clockOutTime: entry.clockOutTime?.toISOString(),
        totalHours: regularHours,
        overtimeHours: overtimeHours > 0 ? overtimeHours : undefined,
        scheduleDate: entry.schedule?.startTime.toISOString().split('T')[0] || entry.clockInTime.toISOString().split('T')[0]
      };
    });

    // For salary employees, use scheduled hours if no time entries
    if (payType === 'SALARY' && timeEntries.length === 0) {
      // Assume 75 hours for semi-monthly period (40 hours/week * 2.5 weeks / 2)
      totalRegularHours = 75;
      totalOvertimeHours = 0;
    }

    // Calculate pay amounts
    const regularPay = totalRegularHours * payRate;
    const overtimePay = totalOvertimeHours * payRate * DEFAULT_OVERTIME_RULES.overtimeMultiplier;
    const grossPay = regularPay + overtimePay;

    // Calculate basic deductions (simplified for MVP)
    const cppDeduction = grossPay * DEFAULT_DEDUCTION_RATES.cpp;
    const eiDeduction = grossPay * DEFAULT_DEDUCTION_RATES.ei;
    const taxDeduction = grossPay * DEFAULT_DEDUCTION_RATES.tax;
    const totalDeductions = cppDeduction + eiDeduction + taxDeduction;

    const netPay = grossPay - totalDeductions;

    return {
      employeeId,
      payPeriodId,
      regularHours: Math.round(totalRegularHours * 100) / 100,
      overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalHours: Math.round((totalRegularHours + totalOvertimeHours) * 100) / 100,
      regularPay: Math.round(regularPay * 100) / 100,
      overtimePay: Math.round(overtimePay * 100) / 100,
      grossPay: Math.round(grossPay * 100) / 100,
      deductions: Math.round(totalDeductions * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
      timeEntriesCount: timeEntries.length,
      timeEntriesDetails
    };
  }

  /**
   * Calculate payroll for all employees in a pay period
   */
  static async calculateBatchPayroll(payPeriodId: string, employeeIds?: string[]): Promise<PayrollBatchCalculation> {
    // Get pay period
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId }
    });

    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    // Get employees to calculate payroll for
    const whereClause: any = {
      status: 'ACTIVE',
      payRate: { not: null },
      payType: { not: null }
    };

    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds };
    }

    const employees = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        payRate: true,
        payType: true
      }
    });

    if (employees.length === 0) {
      throw new Error('No eligible employees found for payroll calculation');
    }

    // Calculate payroll for each employee
    const employeeCalculations: PayrollCalculationResult[] = [];

    for (const employee of employees) {
      try {
        const calculation = await this.calculateEmployeePayroll({
          employeeId: employee.id,
          payPeriodId,
          payRate: Number(employee.payRate!),
          payType: employee.payType! as 'HOURLY' | 'SALARY'
        });

        employeeCalculations.push(calculation);
      } catch (error) {
        console.error(`Error calculating payroll for employee ${employee.id}:`, error);
        // Continue with other employees
      }
    }

    // Calculate batch summary
    const summary = {
      totalEmployees: employeeCalculations.length,
      totalRegularHours: employeeCalculations.reduce((sum, calc) => sum + calc.regularHours, 0),
      totalOvertimeHours: employeeCalculations.reduce((sum, calc) => sum + calc.overtimeHours, 0),
      totalGrossPay: employeeCalculations.reduce((sum, calc) => sum + calc.grossPay, 0),
      totalDeductions: employeeCalculations.reduce((sum, calc) => sum + calc.deductions, 0),
      totalNetPay: employeeCalculations.reduce((sum, calc) => sum + calc.netPay, 0),
      averageHoursPerEmployee: 0,
      averagePayPerEmployee: 0
    };

    // Calculate averages
    if (summary.totalEmployees > 0) {
      summary.averageHoursPerEmployee = Math.round(
        ((summary.totalRegularHours + summary.totalOvertimeHours) / summary.totalEmployees) * 100
      ) / 100;
      summary.averagePayPerEmployee = Math.round((summary.totalGrossPay / summary.totalEmployees) * 100) / 100;
    }

    // Generate period string
    const startDate = new Date(payPeriod.startDate);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const period = startDate.getDate() === 1 ? 'A' : 'B';
    const periodString = `${year}-${month}-${period}`;

    return {
      payPeriodId,
      payPeriod: {
        startDate: payPeriod.startDate.toISOString(),
        endDate: payPeriod.endDate.toISOString(),
        period: periodString
      },
      employees: employeeCalculations,
      summary,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Get comprehensive payroll summary for an employee
   */
  static async getEmployeePayrollSummary(
    employeeId: string,
    payPeriodId?: string
  ): Promise<EmployeePayrollSummary> {
    // Get employee details
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        payRate: true,
        payType: true,
        status: true
      }
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    if (!employee.payRate || !employee.payType) {
      throw new Error('Employee does not have pay rate or pay type configured');
    }

    // Get current pay period if not specified
    let targetPayPeriodId = payPeriodId;
    if (!targetPayPeriodId) {
      const currentPayPeriod = await prisma.payPeriod.findFirst({
        where: {
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      if (!currentPayPeriod) {
        throw new Error('No current pay period found');
      }

      targetPayPeriodId = currentPayPeriod.id;
    }

    // Calculate current period payroll
    const currentPeriod = await this.calculateEmployeePayroll({
      employeeId,
      payPeriodId: targetPayPeriodId,
      payRate: Number(employee.payRate),
      payType: employee.payType as 'HOURLY' | 'SALARY'
    });

    // Get previous periods (last 3 periods)
    const previousPayslips = await prisma.payslip.findMany({
      where: {
        employeeId,
        payPeriodId: { not: targetPayPeriodId }
      },
      include: {
        payPeriod: {
          select: {
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: {
        payPeriod: {
          startDate: 'desc'
        }
      },
      take: 3
    });

    const previousPeriods: PayrollCalculationResult[] = previousPayslips.map(payslip => ({
      employeeId,
      payPeriodId: payslip.payPeriodId,
      regularHours: Number(payslip.regularHours),
      overtimeHours: Number(payslip.overtimeHours),
      totalHours: Number(payslip.regularHours) + Number(payslip.overtimeHours),
      regularPay: Number(payslip.grossPay) - (Number(payslip.overtimeHours) * Number(employee.payRate) * DEFAULT_OVERTIME_RULES.overtimeMultiplier),
      overtimePay: Number(payslip.overtimeHours) * Number(employee.payRate) * DEFAULT_OVERTIME_RULES.overtimeMultiplier,
      grossPay: Number(payslip.grossPay),
      deductions: Number(payslip.deductions),
      netPay: Number(payslip.netPay),
      timeEntriesCount: 0, // Not tracked in historical data
      timeEntriesDetails: []
    }));

    // Calculate YTD summary
    const currentYear = new Date().getFullYear();
    const ytdPayslips = await prisma.payslip.findMany({
      where: {
        employeeId,
        payPeriod: {
          startDate: {
            gte: new Date(currentYear, 0, 1),
            lte: new Date(currentYear, 11, 31)
          }
        }
      }
    });

    const ytdSummary = {
      totalGrossPay: ytdPayslips.reduce((sum, p) => sum + Number(p.grossPay), 0),
      totalNetPay: ytdPayslips.reduce((sum, p) => sum + Number(p.netPay), 0),
      totalHours: ytdPayslips.reduce((sum, p) => sum + Number(p.regularHours) + Number(p.overtimeHours), 0),
      totalDeductions: ytdPayslips.reduce((sum, p) => sum + Number(p.deductions), 0)
    };

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      employeeNumber: employee.employeeNumber || undefined,
      payRate: Number(employee.payRate),
      payType: employee.payType as 'HOURLY' | 'SALARY',
      currentPeriod,
      previousPeriods,
      ytdSummary
    };
  }

  /**
   * Validate payroll calculation before generating payslips
   */
  static async validatePayrollCalculation(payPeriodId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if pay period exists and is in correct status
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId }
    });

    if (!payPeriod) {
      errors.push('Pay period not found');
      return { isValid: false, errors, warnings };
    }

    if (payPeriod.status === 'PAID') {
      errors.push('Cannot calculate payroll for a paid period');
    }

    // Check for employees without pay configuration
    const employeesWithoutPay = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { payRate: null },
          { payType: null }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true
      }
    });

    if (employeesWithoutPay.length > 0) {
      warnings.push(
        `${employeesWithoutPay.length} active employees missing pay configuration: ${
          employeesWithoutPay.map(e => e.employeeNumber || `${e.firstName} ${e.lastName}`).join(', ')
        }`
      );
    }

    // Check for incomplete time entries
    const incompleteTimeEntries = await prisma.timeEntry.findMany({
      where: {
        clockOutTime: null,
        schedule: {
          startTime: {
            gte: payPeriod.startDate,
            lte: payPeriod.endDate
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
        }
      }
    });

    if (incompleteTimeEntries.length > 0) {
      warnings.push(
        `${incompleteTimeEntries.length} incomplete time entries found in pay period`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}