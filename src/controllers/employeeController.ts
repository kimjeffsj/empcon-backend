import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeListRequest,
  EmployeeResponse,
  EmployeeListResponse,
  ApiResponse,
} from "@empcon/types";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// Encryption for SIN
const ENCRYPTION_KEY =
  process.env.SIN_ENCRYPTION_KEY || "your-32-character-secret-key-here"; // Should be 32 characters
const ALGORITHM = "aes-256-cbc";

function encryptSIN(sin: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(sin, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptSIN(encryptedSIN: string): string {
  const parts = encryptedSIN.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Generate employee number
function generateEmployeeNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `EMP${timestamp}${random}`;
}

// Helper to format employee response
function formatEmployeeResponse(employee: any): EmployeeResponse {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: employee.middleName,
    email: employee.email,
    phone: employee.phone,
    addressLine1: employee.addressLine1,
    addressLine2: employee.addressLine2,
    city: employee.city,
    province: employee.province,
    postalCode: employee.postalCode,
    dateOfBirth: employee.dob?.toISOString().split("T")[0] || "",
    hireDate: employee.hireDate.toISOString().split("T")[0],
    payRate: employee.payRate,
    payType: employee.payType,
    status: employee.status,
    departmentId: employee.departmentId,
    positionId: employee.positionId,
    managerId: employee.managerId,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    notes: employee.notes,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    user: employee.user
      ? {
          id: employee.user.id,
          email: employee.user.email,
          role: employee.user.role,
        }
      : undefined,
    department: employee.department
      ? {
          id: employee.department.id,
          name: employee.department.name,
        }
      : undefined,
    position: employee.position
      ? {
          id: employee.position.id,
          title: employee.position.title,
        }
      : undefined,
    manager: employee.manager
      ? {
          id: employee.manager.id,
          firstName: employee.manager.firstName,
          lastName: employee.manager.lastName,
        }
      : undefined,
  };
}

export const employeeController = {
  // GET /api/employees
  async getEmployees(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        departmentId,
        positionId,
        managerId,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query as Partial<EmployeeListRequest>;

      const skip = ((page as number) - 1) * (limit as number);

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { employeeNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
      if (positionId) where.positionId = positionId;
      if (managerId) where.managerId = managerId;

      // Get employees with relations
      const [employees, total] = await Promise.all([
        prisma.employeeProfile.findMany({
          where,
          skip,
          take: limit as number,
          orderBy: { [sortBy as string]: sortOrder },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            position: {
              select: {
                id: true,
                title: true,
              },
            },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.employeeProfile.count({ where }),
      ]);

      const formattedEmployees = employees.map(formatEmployeeResponse);

      const response: EmployeeListResponse = {
        employees: formattedEmployees,
        pagination: {
          total,
          page: page as number,
          limit: limit as number,
          totalPages: Math.ceil(total / (limit as number)),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/employees/:id
  async getEmployeeById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await prisma.employeeProfile.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          error: "Employee not found",
        });
      }

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: formatEmployeeResponse(employee),
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // POST /api/employees
  async createEmployee(req: Request, res: Response) {
    try {
      const employeeData: CreateEmployeeRequest = req.body;

      // Generate employee number
      const employeeNumber = generateEmployeeNumber();

      // Encrypt SIN
      const sinEncrypted = encryptSIN(employeeData.sin);

      // Create user account first
      const user = await prisma.user.create({
        data: {
          email: employeeData.email,
          passwordHash: "", // Will be set when user first logs in
          role: "EMPLOYEE",
          status: "PENDING",
          failedLoginAttempts: 0,
          passwordResetRequired: true,
        },
      });

      // Create employee profile
      const employee = await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          employeeNumber,
          firstName: employeeData.firstName,
          lastName: employeeData.lastName,
          middleName: employeeData.middleName,
          sinEncrypted,
          addressLine1: employeeData.addressLine1,
          addressLine2: employeeData.addressLine2,
          city: employeeData.city,
          province: employeeData.province,
          postalCode: employeeData.postalCode,
          phone: employeeData.phone,
          dob: new Date(employeeData.dateOfBirth),
          hireDate: new Date(employeeData.hireDate),
          payRate: employeeData.payRate,
          payType: employeeData.payType,
          departmentId: employeeData.departmentId,
          positionId: employeeData.positionId,
          managerId: employeeData.managerId,
          status: "ACTIVE",
          emergencyContactName: employeeData.emergencyContactName,
          emergencyContactPhone: employeeData.emergencyContactPhone,
          notes: employeeData.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: formatEmployeeResponse(employee),
        message: "Employee created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // PUT /api/employees/:id
  async updateEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdateEmployeeRequest = req.body;

      // Check if employee exists
      const existingEmployee = await prisma.employeeProfile.findUnique({
        where: { id },
      });

      if (!existingEmployee) {
        return res.status(404).json({
          success: false,
          error: "Employee not found",
        });
      }

      // Prepare update data
      const updatePayload: any = {};

      if (updateData.firstName !== undefined)
        updatePayload.firstName = updateData.firstName;
      if (updateData.lastName !== undefined)
        updatePayload.lastName = updateData.lastName;
      if (updateData.middleName !== undefined)
        updatePayload.middleName = updateData.middleName;
      if (updateData.phone !== undefined)
        updatePayload.phone = updateData.phone;
      if (updateData.addressLine1 !== undefined)
        updatePayload.addressLine1 = updateData.addressLine1;
      if (updateData.addressLine2 !== undefined)
        updatePayload.addressLine2 = updateData.addressLine2;
      if (updateData.city !== undefined) updatePayload.city = updateData.city;
      if (updateData.province !== undefined)
        updatePayload.province = updateData.province;
      if (updateData.postalCode !== undefined)
        updatePayload.postalCode = updateData.postalCode;
      if (updateData.dateOfBirth !== undefined)
        updatePayload.dob = new Date(updateData.dateOfBirth);
      if (updateData.hireDate !== undefined)
        updatePayload.hireDate = new Date(updateData.hireDate);
      if (updateData.payRate !== undefined)
        updatePayload.payRate = updateData.payRate;
      if (updateData.payType !== undefined)
        updatePayload.payType = updateData.payType;
      if (updateData.departmentId !== undefined)
        updatePayload.departmentId = updateData.departmentId;
      if (updateData.positionId !== undefined)
        updatePayload.positionId = updateData.positionId;
      if (updateData.managerId !== undefined)
        updatePayload.managerId = updateData.managerId;
      if (updateData.status !== undefined)
        updatePayload.status = updateData.status;
      if (updateData.emergencyContactName !== undefined)
        updatePayload.emergencyContactName = updateData.emergencyContactName;
      if (updateData.emergencyContactPhone !== undefined)
        updatePayload.emergencyContactPhone = updateData.emergencyContactPhone;
      if (updateData.notes !== undefined)
        updatePayload.notes = updateData.notes;

      // Encrypt SIN if provided
      if (updateData.sin !== undefined) {
        updatePayload.sinEncrypted = encryptSIN(updateData.sin);
      }

      // Update employee
      const employee = await prisma.employeeProfile.update({
        where: { id },
        data: updatePayload,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Update user email if provided
      if (updateData.email && updateData.email !== existingEmployee.userId) {
        await prisma.user.update({
          where: { id: existingEmployee.userId },
          data: { email: updateData.email },
        });
      }

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: formatEmployeeResponse(employee),
        message: "Employee updated successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // DELETE /api/employees/:id
  async deleteEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if employee exists
      const employee = await prisma.employeeProfile.findUnique({
        where: { id },
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          error: "Employee not found",
        });
      }

      // Soft delete - update status to TERMINATED
      await prisma.employeeProfile.update({
        where: { id },
        data: { status: "TERMINATED" },
      });

      // Also deactivate user account
      await prisma.user.update({
        where: { id: employee.userId },
        data: { status: "INACTIVE" },
      });

      const response: ApiResponse = {
        success: true,
        message: "Employee deleted successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};
