import { PrismaClient } from "@prisma/client";
import {
  PayPeriod,
  CreatePayPeriodRequest,
  UpdatePayPeriodRequest,
  GetPayPeriodsParams,
  GetPayPeriodsResponse,
  CreatePayPeriodResponse,
  GetCurrentPayPeriodResponse,
  PayPeriodSummary,
} from "@empcon/types";
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const PACIFIC_TIMEZONE = 'America/Vancouver';

export class PayPeriodService {
  /**
   * Generate semi-monthly pay period dates in Pacific Time
   * A period: 1st-15th of month
   * B period: 16th-last day of month
   */
  static generatePayPeriodDates(year: number, month: number, period: 'A' | 'B') {
    // Determine start and end days
    const startDay = period === 'A' ? 1 : 16;

    let endDay: number;
    if (period === 'A') {
      endDay = 15;
    } else {
      // Get last day of month using JavaScript Date (month+1, day 0 = last day of previous month)
      endDay = new Date(year, month, 0).getDate();
    }

    // Build Pacific Time date strings
    const monthStr = String(month).padStart(2, '0');
    const startDateStr = `${year}-${monthStr}-${String(startDay).padStart(2, '0')}T00:00:00`;
    const endDateStr = `${year}-${monthStr}-${String(endDay).padStart(2, '0')}T23:59:59`;

    // Convert Pacific Time strings to UTC Date objects for database storage
    const startDate = fromZonedTime(startDateStr, PACIFIC_TIMEZONE);
    const endDate = fromZonedTime(endDateStr, PACIFIC_TIMEZONE);

    // Debug logging - Verify timezone conversion accuracy
    const startDatePacific = toZonedTime(startDate, PACIFIC_TIMEZONE);
    const endDatePacific = toZonedTime(endDate, PACIFIC_TIMEZONE);

    console.log('=== PayPeriod Date Generation Debug ===');
    console.log('Input:', { year, month, period, startDay, endDay });
    console.log('Pacific Time Strings:', { startDateStr, endDateStr });
    console.log('Converted to UTC:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    console.log('Verify - UTC back to Pacific:', {
      startDate: startDatePacific.toISOString(),
      endDate: endDatePacific.toISOString()
    });
    console.log('✓ Expected:', {
      startDate: `Pacific ${year}-${monthStr}-${String(startDay).padStart(2, '0')} 00:00:00`,
      endDate: `Pacific ${year}-${monthStr}-${String(endDay).padStart(2, '0')} 23:59:59`
    });
    console.log('=====================================');

    // Calculate pay date (5 days after period end)
    const payDay = endDay + 5;
    // Check if pay date goes into next month
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    let payMonth = month;
    let payYear = year;
    let actualPayDay = payDay;

    if (payDay > lastDayOfMonth) {
      actualPayDay = payDay - lastDayOfMonth;
      payMonth = month + 1;
      if (payMonth > 12) {
        payMonth = 1;
        payYear = year + 1;
      }
    }

    const payDateStr = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(actualPayDay).padStart(2, '0')}T00:00:00`;
    const payDate = fromZonedTime(payDateStr, PACIFIC_TIMEZONE);

    return {
      startDate,
      endDate,
      payDate
    };
  }

  /**
   * Create a new pay period
   */
  static async createPayPeriod(request: CreatePayPeriodRequest): Promise<CreatePayPeriodResponse> {
    const { year, month, period } = request;

    // Check if pay period already exists
    const dates = this.generatePayPeriodDates(year, month, period);

    const existingPayPeriod = await prisma.payPeriod.findFirst({
      where: {
        startDate: dates.startDate,
        endDate: dates.endDate
      }
    });

    if (existingPayPeriod) {
      throw new Error(`Pay period ${year}-${String(month).padStart(2, '0')}-${period} already exists`);
    }

    // Create new pay period
    const payPeriod = await prisma.payPeriod.create({
      data: {
        startDate: dates.startDate,
        endDate: dates.endDate,
        payDate: dates.payDate,
        status: 'OPEN'
      }
    });

    return {
      payPeriod: this.formatPayPeriodResponse(payPeriod),
      message: `Pay period ${year}-${String(month).padStart(2, '0')}-${period} created successfully`
    };
  }

  /**
   * Get pay periods with filtering and pagination
   */
  static async getPayPeriods(params: GetPayPeriodsParams): Promise<GetPayPeriodsResponse> {
    const { year, month, status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (year && month) {
      // Filter by specific year and month
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      where.startDate = {
        gte: startOfMonth,
        lte: endOfMonth
      };
    } else if (year) {
      // Filter by year only
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);

      where.startDate = {
        gte: startOfYear,
        lte: endOfYear
      };
    }

    if (status) {
      where.status = status;
    }

    // Get pay periods with pagination
    const [payPeriods, total] = await Promise.all([
      prisma.payPeriod.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { startDate: 'desc' },
        include: {
          _count: {
            select: { payslips: true }
          }
        }
      }),
      prisma.payPeriod.count({ where })
    ]);

    const formattedPayPeriods = payPeriods.map(this.formatPayPeriodResponse);

    return {
      data: formattedPayPeriods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get current, next, and previous pay periods
   */
  static async getCurrentPayPeriod(): Promise<GetCurrentPayPeriodResponse> {
    const now = new Date();

    // Find current pay period (where current date falls between start and end date)
    const currentPeriod = await prisma.payPeriod.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });

    // Get next pay period
    const nextPeriod = await prisma.payPeriod.findFirst({
      where: {
        startDate: { gt: now }
      },
      orderBy: { startDate: 'asc' }
    });

    // Get previous pay period
    const previousPeriod = await prisma.payPeriod.findFirst({
      where: {
        endDate: { lt: now }
      },
      orderBy: { endDate: 'desc' }
    });

    return {
      currentPeriod: currentPeriod ? this.formatPayPeriodResponse(currentPeriod) : undefined,
      nextPeriod: nextPeriod ? this.formatPayPeriodResponse(nextPeriod) : undefined,
      previousPeriod: previousPeriod ? this.formatPayPeriodResponse(previousPeriod) : undefined
    };
  }

  /**
   * Update pay period
   */
  static async updatePayPeriod(id: string, request: UpdatePayPeriodRequest): Promise<PayPeriod> {
    const { payDate, status } = request;

    // Check if pay period exists
    const existingPayPeriod = await prisma.payPeriod.findUnique({
      where: { id }
    });

    if (!existingPayPeriod) {
      throw new Error('Pay period not found');
    }

    // Update pay period
    const updateData: any = {};

    if (payDate) {
      updateData.payDate = new Date(payDate);
    }

    if (status) {
      updateData.status = status;
    }

    const updatedPayPeriod = await prisma.payPeriod.update({
      where: { id },
      data: updateData
    });

    return this.formatPayPeriodResponse(updatedPayPeriod);
  }

  /**
   * Delete pay period (only if no payslips exist)
   */
  static async deletePayPeriod(id: string): Promise<void> {
    // Check if pay period exists
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id },
      include: {
        _count: {
          select: { payslips: true }
        }
      }
    });

    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    if (payPeriod._count.payslips > 0) {
      throw new Error('Cannot delete pay period with existing payslips');
    }

    await prisma.payPeriod.delete({
      where: { id }
    });
  }

  /**
   * Get pay period summary with payslip statistics
   */
  static async getPayPeriodSummary(id: string): Promise<PayPeriodSummary> {
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id },
      include: {
        payslips: {
          select: {
            grossPay: true,
            netPay: true,
            employeeId: true
          }
        }
      }
    });

    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    // Calculate summary statistics
    const totalGrossPay = payPeriod.payslips.reduce((sum, payslip) =>
      sum + Number(payslip.grossPay), 0);

    const totalNetPay = payPeriod.payslips.reduce((sum, payslip) =>
      sum + Number(payslip.netPay), 0);

    const uniqueEmployees = new Set(payPeriod.payslips.map(p => p.employeeId));

    // Generate period string (e.g., "2024-01-A")
    const startDate = new Date(payPeriod.startDate);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const period = startDate.getDate() === 1 ? 'A' : 'B';
    const periodString = `${year}-${month}-${period}`;

    return {
      id: payPeriod.id,
      period: periodString,
      startDate: payPeriod.startDate.toISOString(),
      endDate: payPeriod.endDate.toISOString(),
      payDate: payPeriod.payDate.toISOString(),
      status: payPeriod.status,
      employeeCount: uniqueEmployees.size,
      totalPayslips: payPeriod.payslips.length,
      totalGrossPay,
      totalNetPay
    };
  }

  /**
   * Get current date in Pacific Time
   * Returns year, month, day as numbers for business logic
   */
  static getPacificTimeToday(): { year: number; month: number; day: number } {
    const now = new Date();
    const pacificFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Vancouver',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = pacificFormatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

    return { year, month, day };
  }

  /**
   * Check if completed pay period can be generated today (Pacific Time)
   * Returns generation info or null if cannot generate
   */
  static canGenerateCompletedPeriod(): {
    canGenerate: boolean;
    reason: string;
    periodInfo?: {
      year: number;
      month: number;
      period: 'A' | 'B';
      description: string;
    };
  } {
    const pacificToday = this.getPacificTimeToday();
    const { year, month, day } = pacificToday;

    if (day === 16) {
      // 16th of month: Generate A period (1st-15th of current month)
      return {
        canGenerate: true,
        reason: "16th of month - can generate A period for completed 1st-15th period",
        periodInfo: {
          year,
          month,
          period: 'A',
          description: `${year}-${String(month).padStart(2, '0')}-A (${year}/${String(month).padStart(2, '0')}/01 - ${year}/${String(month).padStart(2, '0')}/15)`
        }
      };
    } else if (day === 1) {
      // 1st of month: Generate B period (16th-end of previous month)
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate(); // Last day of previous month

      return {
        canGenerate: true,
        reason: "1st of month - can generate B period for completed previous month 16th-end period",
        periodInfo: {
          year: prevYear,
          month: prevMonth,
          period: 'B',
          description: `${prevYear}-${String(prevMonth).padStart(2, '0')}-B (${prevYear}/${String(prevMonth).padStart(2, '0')}/16 - ${prevYear}/${String(prevMonth).padStart(2, '0')}/${lastDay})`
        }
      };
    } else {
      return {
        canGenerate: false,
        reason: `Today is ${day}th - can only generate on 16th (A period) or 1st (B period) of month`
      };
    }
  }

  /**
   * Create PayPeriod for completed work period based on current Pacific Time date
   * 16th of month → Create A period (1st-15th of current month)
   * 1st of month → Create B period (16th-end of previous month)
   */
  static async createCompletedPeriodPayPeriod(): Promise<CreatePayPeriodResponse> {
    // Check if generation is allowed
    const generationCheck = this.canGenerateCompletedPeriod();

    if (!generationCheck.canGenerate) {
      throw new Error(generationCheck.reason);
    }

    const { periodInfo } = generationCheck;
    if (!periodInfo) {
      throw new Error("Period information is missing");
    }

    // Use existing createPayPeriod method
    try {
      const result = await this.createPayPeriod({
        year: periodInfo.year,
        month: periodInfo.month,
        period: periodInfo.period
      });

      return {
        payPeriod: result.payPeriod,
        message: `Auto-generated ${periodInfo.description} successfully`
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new Error(`${periodInfo.description} already exists - cannot generate duplicate period`);
      }
      throw error;
    }
  }

  /**
   * Auto-generate upcoming pay periods (utility function)
   */
  static async generateUpcomingPeriods(monthsAhead: number = 3): Promise<PayPeriod[]> {
    const now = new Date();
    const generatedPeriods: PayPeriod[] = [];

    for (let i = 0; i < monthsAhead * 2; i++) {
      const month = now.getMonth() + Math.floor(i / 2) + 1;
      const year = now.getFullYear() + Math.floor((now.getMonth() + Math.floor(i / 2)) / 12);
      const adjustedMonth = ((month - 1) % 12) + 1;
      const adjustedYear = year + Math.floor((month - 1) / 12);
      const period = i % 2 === 0 ? 'A' : 'B';

      try {
        const result = await this.createPayPeriod({
          year: adjustedYear,
          month: adjustedMonth,
          period
        });
        generatedPeriods.push(result.payPeriod);
      } catch (error) {
        // Skip if period already exists
        if (error instanceof Error && !error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    return generatedPeriods;
  }

  /**
   * Format PayPeriod for API response
   * Returns full ISO timestamps to preserve timezone accuracy for TimeClock filtering
   * Frontend will handle display conversion to Pacific Time
   */
  static formatPayPeriodResponse(payPeriod: any): PayPeriod {
    return {
      id: payPeriod.id,
      startDate: payPeriod.startDate.toISOString(),
      endDate: payPeriod.endDate.toISOString(),
      payDate: payPeriod.payDate.toISOString(),
      status: payPeriod.status,
      createdAt: payPeriod.createdAt.toISOString(),
      updatedAt: payPeriod.updatedAt.toISOString()
    };
  }
}