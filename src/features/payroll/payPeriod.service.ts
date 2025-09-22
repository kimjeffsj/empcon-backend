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

const prisma = new PrismaClient();

export class PayPeriodService {
  /**
   * Generate semi-monthly pay period dates
   * A period: 1st-15th of month
   * B period: 16th-last day of month
   */
  static generatePayPeriodDates(year: number, month: number, period: 'A' | 'B') {
    const startDate = new Date(year, month - 1, period === 'A' ? 1 : 16);

    let endDate: Date;
    if (period === 'A') {
      endDate = new Date(year, month - 1, 15);
    } else {
      // Get last day of month
      endDate = new Date(year, month, 0); // Day 0 = last day of previous month
    }

    // Pay date is typically 3-5 business days after period end
    // For MVP, set pay date to 5 days after period end
    const payDate = new Date(endDate);
    payDate.setDate(payDate.getDate() + 5);

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