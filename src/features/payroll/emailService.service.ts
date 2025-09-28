import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { PayPeriodService } from './payPeriod.service';
import { ExcelReportService } from './excelReport.service';

export interface SendToAccountantOptions {
  payPeriodId: string;
  accountantEmail?: string;
}

export interface EmailLog {
  payPeriodId: string;
  recipientEmail: string;
  sentAt: Date;
  success: boolean;
  error?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter;

  // Initialize email transporter
  static initializeTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false // For development
        }
      });
    }
    return this.transporter;
  }

  static async sendToAccountant(options: SendToAccountantOptions): Promise<EmailLog> {
    const { payPeriodId, accountantEmail } = options;

    try {
      // Get pay period information
      const payPeriod = await PayPeriodService.getPayPeriodSummary(payPeriodId);
      if (!payPeriod) {
        throw new Error('Pay period not found');
      }

      // Generate Excel report
      const excelBuffer = await ExcelReportService.generatePayrollReport({ payPeriodId });

      // Prepare email content
      const emailContent = this.prepareEmailContent(payPeriod);

      // Determine recipient email
      const recipientEmail = accountantEmail || process.env.ACCOUNTANT_EMAIL;
      if (!recipientEmail) {
        throw new Error('No accountant email provided');
      }

      // Initialize transporter
      const transporter = this.initializeTransporter();

      // Format filename with period info - parse period format "2024-01-A"
      const [year, month, period] = payPeriod.period.split('-');
      const filename = `Payroll_Report_${year}-${month}_Period${period}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Send email
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: recipientEmail,
        subject: `[EmpCon] Payroll Report - ${year}-${month} Period ${period}`,
        html: emailContent,
        attachments: [
          {
            filename: filename,
            content: excelBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        ]
      };

      const info = await transporter.sendMail(mailOptions);

      // Log successful send
      const emailLog: EmailLog = {
        payPeriodId,
        recipientEmail,
        sentAt: new Date(),
        success: true
      };

      console.log('Email sent successfully:', info.messageId);
      return emailLog;

    } catch (error) {
      console.error('Email send failed:', error);

      // Log failed send
      const emailLog: EmailLog = {
        payPeriodId,
        recipientEmail: accountantEmail || process.env.ACCOUNTANT_EMAIL || 'unknown',
        sentAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      return emailLog;
    }
  }

  private static prepareEmailContent(payPeriod: any): string {
    const template = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c5aa0; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #2c5aa0; }
            .footer { margin-top: 20px; padding: 15px; text-align: center; color: #666; font-size: 12px; }
            .highlight { color: #2c5aa0; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💼 EmpCon Payroll Report</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>The payroll processing for {{year}}-{{month}} {{periodName}} has been completed. Please find the attached report.</p>

                <div class="info-box">
                    <h3>📊 Pay Period Information</h3>
                    <p><strong>Pay Period:</strong> {{year}}-{{month}} {{periodName}}</p>
                    <p><strong>Period:</strong> {{startDate}} ~ {{endDate}}</p>
                    <p><strong>Pay Date:</strong> {{payDate}}</p>
                    <p><strong>Report Generated:</strong> {{generatedDate}}</p>
                </div>

                <div class="info-box">
                    <h3>📋 Attachment Information</h3>
                    <p>The attached Excel file contains the following information:</p>
                    <ul>
                        <li><strong>Payroll Summary:</strong> Overall payroll status overview</li>
                        <li><strong>Employee Details:</strong> Individual employee payroll details</li>
                        <li><strong>Anomaly Report:</strong> Items requiring review</li>
                    </ul>
                </div>

                <div class="info-box">
                    <h3>⚠️ Review Required</h3>
                    <p>Please review the attached payroll report and feel free to contact us if you have any questions.</p>
                    <p class="highlight">Please pay special attention to the items in the 'Anomaly Report' sheet.</p>
                </div>

                <p>Thank you.</p>
                <p><strong>EmpCon Payroll Management System</strong></p>
            </div>
            <div class="footer">
                <p>This email was automatically sent by the EmpCon Payroll Management System.</p>
                <p>If you have any questions, please contact the system administrator.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const compiledTemplate = Handlebars.compile(template);

    // Parse period format "2024-01-A" -> year, month, period
    const [year, month, period] = payPeriod.period.split('-');
    const periodName = period === 'A' ? 'Period A (1st-15th)' : 'Period B (16th-end)';
    const startDate = new Date(payPeriod.startDate).toLocaleDateString('en-CA');
    const endDate = new Date(payPeriod.endDate).toLocaleDateString('en-CA');
    const payDate = new Date(payPeriod.payDate).toLocaleDateString('en-CA');
    const generatedDate = new Date().toLocaleDateString('en-CA');

    return compiledTemplate({
      year,
      month,
      periodName,
      startDate,
      endDate,
      payDate,
      generatedDate
    });
  }

  // Test email configuration
  static async testEmailConfig(): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      await transporter.verify();
      console.log('Email configuration verified successfully');
      return true;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return false;
    }
  }
}