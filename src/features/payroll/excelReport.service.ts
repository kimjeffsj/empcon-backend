import ExcelJS from 'exceljs';
import { PayPeriodService } from './payPeriod.service';
import { PayslipService } from './payslip.service';
import { PayrollCalculationService } from './payrollCalculation.service';

export interface ExcelReportOptions {
  payPeriodId: string;
  format?: 'excel' | 'pdf';
}

export class ExcelReportService {
  static async generatePayrollReport(options: ExcelReportOptions): Promise<Buffer> {
    const { payPeriodId } = options;

    // Get pay period data
    const payPeriod = await PayPeriodService.getPayPeriodSummary(payPeriodId);
    if (!payPeriod) {
      throw new Error('Pay period not found');
    }

    // Get payroll summary data
    const payrollSummary = await PayslipService.getPayrollSummaryByPeriod(payPeriodId);

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Set workbook properties
    workbook.creator = 'EmpCon Payroll System';
    workbook.lastModifiedBy = 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Generate sheets
    await this.createSummarySheet(workbook, payPeriod, payrollSummary);
    await this.createEmployeeDetailsSheet(workbook, payrollSummary);
    await this.createAnomalyReportSheet(workbook, payrollSummary);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  private static async createSummarySheet(
    workbook: ExcelJS.Workbook,
    payPeriod: any,
    payrollSummary: any
  ): Promise<void> {
    const worksheet = workbook.addWorksheet('Payroll Summary');

    // Header section
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'EmpCon Payroll Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Pay period info - parse period format "2024-01-A"
    const [year, month, period] = payPeriod.period.split('-');
    const periodType = period === 'A' ? 'Period A (1st-15th)' : 'Period B (16th-end)';
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `Pay Period: ${year}-${month} ${periodType}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:H3');
    worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-CA')}`;
    worksheet.getCell('A3').font = { size: 10 };
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Summary statistics
    const totalEmployees = payrollSummary.employees?.length || 0;
    const totalHours = payrollSummary.employees?.reduce((sum: number, emp: any) => sum + (emp.totalHours || 0), 0) || 0;
    const totalGrossPay = payrollSummary.employees?.reduce((sum: number, emp: any) => sum + (emp.grossPay || 0), 0) || 0;
    const anomalyEmployees = payrollSummary.employees?.filter((emp: any) => emp.hasAnomalies).length || 0;
    const reviewNeeded = payrollSummary.employees?.filter((emp: any) => emp.status === 'NEEDS_REVIEW').length || 0;

    worksheet.getCell('A5').value = 'Total Employees:';
    worksheet.getCell('B5').value = totalEmployees;

    worksheet.getCell('A6').value = 'Total Hours:';
    worksheet.getCell('B6').value = `${totalHours.toLocaleString()} hours`;

    worksheet.getCell('A7').value = 'Total Gross Pay:';
    worksheet.getCell('B7').value = `$${totalGrossPay.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

    worksheet.getCell('A8').value = 'Employees with Anomalies:';
    worksheet.getCell('B8').value = anomalyEmployees;

    worksheet.getCell('A9').value = 'Review Required:';
    worksheet.getCell('B9').value = reviewNeeded;

    // Style the summary section
    for (let row = 5; row <= 9; row++) {
      worksheet.getCell(`A${row}`).font = { bold: true };
      worksheet.getCell(`B${row}`).font = { bold: false };
    }

    // Set column widths
    worksheet.columns = [
      { key: 'A', width: 15 },
      { key: 'B', width: 20 },
      { key: 'C', width: 15 },
      { key: 'D', width: 15 },
      { key: 'E', width: 15 },
      { key: 'F', width: 15 },
      { key: 'G', width: 15 },
      { key: 'H', width: 15 }
    ];
  }

  private static async createEmployeeDetailsSheet(
    workbook: ExcelJS.Workbook,
    payrollSummary: any
  ): Promise<void> {
    const worksheet = workbook.addWorksheet('Employee Details');

    // Header row
    const headers = ['Employee Name', 'Department', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Hourly Rate', 'Gross Pay', 'Status', 'Notes'];
    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add employee data
    if (payrollSummary.employees) {
      for (const employee of payrollSummary.employees) {
        const status = employee.hasAnomalies ? 'Review Required' :
                     employee.status === 'APPROVED' ? 'Approved' : 'Processing';

        const anomalyNote = employee.anomalyReasons?.length > 0 ?
                           employee.anomalyReasons.join(', ') : '';

        worksheet.addRow([
          employee.employee?.name || 'Unknown',
          employee.employee?.department?.name || 'Unassigned',
          `${employee.totalHours}h`,
          `${employee.regularHours}h`,
          `${employee.overtimeHours}h`,
          `$${employee.employee?.payRate?.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`,
          `$${employee.grossPay?.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`,
          status,
          anomalyNote
        ]);
      }
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 12;
    });

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }

  private static async createAnomalyReportSheet(
    workbook: ExcelJS.Workbook,
    payrollSummary: any
  ): Promise<void> {
    const worksheet = workbook.addWorksheet('Anomaly Report');

    // Header row
    const headers = ['Employee Name', 'Anomaly Type', 'Details', 'Recommended Action'];
    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCC00' }
    };

    // Add anomaly data
    if (payrollSummary.employees) {
      const anomalyEmployees = payrollSummary.employees.filter((emp: any) => emp.hasAnomalies);

      if (anomalyEmployees.length === 0) {
        worksheet.addRow(['', 'No anomalies detected.', '', '']);
      } else {
        for (const employee of anomalyEmployees) {
          if (employee.anomalyReasons?.length > 0) {
            for (const reason of employee.anomalyReasons) {
              let solution = '';
              if (reason.includes('consecutive') || reason.includes('연속')) {
                solution = 'Schedule adjustment required';
              } else if (reason.includes('overtime') || reason.includes('초과')) {
                solution = 'Verify overtime approval';
              } else if (reason.includes('missing') || reason.includes('누락')) {
                solution = 'Manual time entry required';
              } else {
                solution = 'Manager review required';
              }

              worksheet.addRow([
                employee.employee?.name || 'Unknown',
                reason,
                'Irregular pattern detected during pay period',
                solution
              ]);
            }
          }
        }
      }
    }

    // Auto-fit columns
    worksheet.columns = [
      { key: 'A', width: 15 },
      { key: 'B', width: 25 },
      { key: 'C', width: 30 },
      { key: 'D', width: 25 }
    ];

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }
}