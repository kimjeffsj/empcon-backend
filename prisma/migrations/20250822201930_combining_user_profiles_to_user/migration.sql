/*
  Warnings:

  - You are about to drop the `employee_profiles` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[employee_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."departments" DROP CONSTRAINT "departments_manager_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_profiles" DROP CONSTRAINT "employee_profiles_department_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_profiles" DROP CONSTRAINT "employee_profiles_manager_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_profiles" DROP CONSTRAINT "employee_profiles_position_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."employee_profiles" DROP CONSTRAINT "employee_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "address_line1" TEXT,
ADD COLUMN     "address_line2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "emergency_contact_name" TEXT,
ADD COLUMN     "emergency_contact_phone" TEXT,
ADD COLUMN     "employee_number" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "hire_date" TIMESTAMP(3),
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "manager_id" TEXT,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pay_rate" DECIMAL(10,2),
ADD COLUMN     "pay_type" "public"."PayType",
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position_id" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "sin_encrypted" TEXT;

-- DropTable
DROP TABLE "public"."employee_profiles";

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_number_key" ON "public"."users"("employee_number");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
