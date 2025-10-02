import ExcelJS from "exceljs";
import prisma from "@/config/database.config";

export interface ExcelReportOptions {
  payPeriodId: string;
  format?: "excel" | "pdf";
}

interface PayrollData {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  payRate: number;
  grossPay: number;
}

export class ExcelReportService {
  static async generatePayrollReport(options: ExcelReportOptions) {
    const { payPeriodId } = options;

    // Get pay period
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
    });
    if (!payPeriod) {
      throw new Error("Pay period not found");
    }

    // Aggregate TimeEntry data directly (no Payslip dependency)
    const payrollData = await this.aggregateTimeEntries(payPeriodId, payPeriod);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EmpCon Payroll System";
    workbook.created = new Date();

    // Generate single simple sheet
    await this.createSimplePayrollSheet(workbook, payPeriod, payrollData);

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Aggregate TimeEntry data for pay period
   * Directly queries TimeEntry instead of using Payslip
   */
  private static async aggregateTimeEntries(
    payPeriodId: string,
    payPeriod: any
  ): Promise<PayrollData[]> {
    // Get all active employees
    const employees = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: "EMPLOYEE",
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        payRate: true,
      },
      orderBy: {
        employeeNumber: "asc",
      },
    });

    const payrollData: PayrollData[] = [];

    for (const employee of employees) {
      // Get time entries for this employee in pay period
      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          employeeId: employee.id,
          clockInTime: { gte: payPeriod.startDate },
          clockOutTime: { lte: payPeriod.endDate },
          status: { in: ["CLOCKED_OUT", "ADJUSTED"] },
        },
      });

      // Calculate hours
      let regularHours = 0;
      let overtimeHours = 0;

      for (const entry of timeEntries) {
        const entryRegular = entry.totalHours
          ? Number(entry.totalHours) -
            (entry.overtimeHours ? Number(entry.overtimeHours) : 0)
          : 0;
        const entryOvertime = entry.overtimeHours
          ? Number(entry.overtimeHours)
          : 0;

        regularHours += entryRegular;
        overtimeHours += entryOvertime;
      }

      const totalHours = regularHours + overtimeHours;

      // Calculate gross pay
      const payRate = employee.payRate ? Number(employee.payRate) : 0;
      const grossPay = regularHours * payRate + overtimeHours * payRate * 1.5;

      // Only include employees with hours worked
      if (totalHours > 0) {
        payrollData.push({
          employeeNumber: employee.employeeNumber || "",
          firstName: employee.firstName || "",
          lastName: employee.lastName || "",
          regularHours: Number(regularHours.toFixed(2)),
          overtimeHours: Number(overtimeHours.toFixed(2)),
          totalHours: Number(totalHours.toFixed(2)),
          payRate: Number(payRate.toFixed(2)),
          grossPay: Number(grossPay.toFixed(2)),
        });
      }
    }

    return payrollData;
  }

  /**
   * Create simplified payroll sheet for accountant
   * Format: 순번 | Last Name | First Name | Regular Hours | Overtime Hours | Total Hours | Sum
   */
  private static async createSimplePayrollSheet(
    workbook: ExcelJS.Workbook,
    payPeriod: any,
    payrollData: PayrollData[]
  ): Promise<void> {
    const worksheet = workbook.addWorksheet("Payroll");

    // Generate filename: "September A Payroll.xlsx"
    const startDate = new Date(payPeriod.startDate);
    const month = startDate.toLocaleString("en-US", { month: "long" });
    const day = startDate.getDate();
    const period = day === 1 ? "A" : "B";

    workbook.title = `${month} ${period} Payroll`;

    // Header row
    const headers = [
      "No",
      "Last Name",
      "First Name",
      "Regular Hours",
      "Overtime Hours",
      "Total Hours",
      "PayRate",
      "Sum",
    ];

    const headerRow = worksheet.addRow(headers);

    // Style header row
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Add employee data
    let rowNumber = 1;
    for (const employee of payrollData) {
      worksheet.addRow([
        rowNumber,
        employee.lastName,
        employee.firstName,
        employee.regularHours.toFixed(2),
        employee.overtimeHours.toFixed(2),
        employee.totalHours.toFixed(2),
        employee.payRate.toFixed(2),
        employee.grossPay.toFixed(2),
      ]);

      rowNumber++;
    }

    // Set column widths
    worksheet.columns = [
      { key: "A", width: 8 }, // No
      { key: "B", width: 15 }, // Last Name
      { key: "C", width: 15 }, // First Name
      { key: "D", width: 15 }, // Regular Hours
      { key: "E", width: 15 }, // Overtime Hours
      { key: "F", width: 15 }, // Total Hours
      { key: "G", width: 15 }, // PayRate
      { key: "H", width: 15 }, // Sum
    ];

    // Add borders to all cells
    worksheet.eachRow((row, rowIndex) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // Center align all cells
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    });
  }
}
