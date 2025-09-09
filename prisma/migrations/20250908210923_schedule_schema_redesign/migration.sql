/*
  Warnings:

  - You are about to drop the column `date` on the `schedules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employee_id,start_time,end_time]` on the table `schedules` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `start_time` on the `schedules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `end_time` on the `schedules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."schedules" DROP CONSTRAINT "schedules_employee_id_fkey";

-- DropIndex
DROP INDEX "public"."schedules_employee_id_date_key";

-- AlterTable
ALTER TABLE "public"."schedules" DROP COLUMN "date",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "position" TEXT,
DROP COLUMN "start_time",
ADD COLUMN     "start_time" TIMESTAMP(3) NOT NULL,
DROP COLUMN "end_time",
ADD COLUMN     "end_time" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."time_entries" ADD COLUMN     "adjusted_end_time" TIMESTAMP(3),
ADD COLUMN     "adjusted_start_time" TIMESTAMP(3),
ADD COLUMN     "grace_period_applied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduled_end_time" TIMESTAMP(3),
ADD COLUMN     "scheduled_start_time" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "schedules_employee_id_start_time_idx" ON "public"."schedules"("employee_id", "start_time");

-- CreateIndex
CREATE INDEX "schedules_start_time_end_time_idx" ON "public"."schedules"("start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_employee_id_start_time_end_time_key" ON "public"."schedules"("employee_id", "start_time", "end_time");

-- AddForeignKey
ALTER TABLE "public"."schedules" ADD CONSTRAINT "schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."schedules" ADD CONSTRAINT "schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
