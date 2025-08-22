import { PrismaClient, Status } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Check for required environment variables
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required for seeding"
    );
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashedPassword,
      role: "ADMIN",
      status: Status.ACTIVE,
    },
  });

  console.log(`Admin user created with email: ${adminEmail}`);

  // Create departments
  const department = await prisma.department.create({
    data: {
      name: "Chicko Chicken",
      createdBy: adminUser.id,
    },
  });

  console.log(`Department created: ${department.name}`);

  // Create positions
  const position = await prisma.position.create({
    data: {
      departmentId: department.id,
      title: "Employee",
      createdBy: adminUser.id,
    },
  });

  console.log(`Position created: ${position.title}`);

  // Create leave types
  const leaveTypes = await prisma.leaveType.createMany({
    data: [
      { name: "Vacation", description: "Annual vacation leave", isPaid: true },
      { name: "Sick Leave", description: "Medical leave", isPaid: true },
      { name: "Personal", description: "Personal time off", isPaid: false },
      { name: "Emergency", description: "Emergency leave", isPaid: true },
    ],
  });

  console.log(`${leaveTypes.count} leave types created`);

  console.log("Database seeded successfully!");
  console.log("\nCreated:");
  console.log(`- Admin User: ${adminEmail}`);
  console.log(`- Department: ${department.name}`);
  console.log(`- Position: ${position.title}`);
  console.log(`- Leave Types: ${leaveTypes.count} types`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
