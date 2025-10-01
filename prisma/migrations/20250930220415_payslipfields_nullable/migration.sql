-- AlterTable
ALTER TABLE "public"."payslips" ALTER COLUMN "regular_hours" DROP NOT NULL,
ALTER COLUMN "overtime_hours" DROP NOT NULL,
ALTER COLUMN "gross_pay" DROP NOT NULL,
ALTER COLUMN "deductions" DROP NOT NULL,
ALTER COLUMN "net_pay" DROP NOT NULL;
