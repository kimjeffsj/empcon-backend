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
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(sin, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptSIN(encryptedSIN: string): string {
  const parts = encryptedSIN.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    iv
  );
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
function formatEmployeeResponse(
  user: any,
  userRole?: string,
  currentUserId?: string
): EmployeeResponse {
  // Determine if SIN should be included
  let includeSIN = false;
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    includeSIN = true;
  } else if (
    userRole === "EMPLOYEE" &&
    currentUserId &&
    user.id === currentUserId
  ) {
    includeSIN = true; // Employee can see their own SIN
  }

  const response: EmployeeResponse = {
    id: user.id,
    employeeNumber: user.employeeNumber || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    middleName: user.middleName,
    email: user.email,
    phone: user.phone,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    province: user.province,
    postalCode: user.postalCode,
    dateOfBirth: user.dateOfBirth,
    hireDate: user.hireDate,
    payRate: user.payRate || 0,
    payType: user.payType || "HOURLY",
    status: user.status,
    departmentId: user.departmentId,
    positionId: user.positionId,
    managerId: user.managerId,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    notes: user.notes,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    department: user.department
      ? {
          id: user.department.id,
          name: user.department.name,
        }
      : undefined,
    position: user.position
      ? {
          id: user.position.id,
          title: user.position.title,
        }
      : undefined,
    manager: user.manager
      ? {
          id: user.manager.id,
          firstName: user.manager.firstName,
          lastName: user.manager.lastName,
        }
      : undefined,
  };

  // Include SIN if user has permission
  if (includeSIN && user.sinEncrypted) {
    try {
      response.sin = decryptSIN(user.sinEncrypted);
    } catch (error) {
      console.error("Error decrypting SIN:", error);
      // Don't include SIN if decryption fails
    }
  }

  return response;
}

export const employeeController = {
  // GET /api/employees/validate/email - Check email availability
  async validateEmail(req: Request, res: Response) {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Email parameter is required'
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true }
      });

      res.json({
        success: true,
        data: {
          available: !existingUser,
          message: existingUser ? 'Email is already in use' : 'Email is available'
        }
      });
    } catch (error) {
      console.error('Error validating email:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  },

  // GET /api/employees/validate/employee-number - Check employee number availability
  async validateEmployeeNumber(req: Request, res: Response) {
    try {
      const { number } = req.query;
      
      if (!number || typeof number !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Employee number parameter is required'
        });
      }

      const existingUser = await prisma.user.findFirst({
        where: { employeeNumber: number },
        select: { id: true, employeeNumber: true }
      });

      res.json({
        success: true,
        data: {
          available: !existingUser,
          message: existingUser ? 'Employee number is already in use' : 'Employee number is available'
        }
      });
    } catch (error) {
      console.error('Error validating employee number:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  },

  // GET /api/employees/:id/sin - Get employee SIN (ADMIN only)
  async getEmployeeSIN(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if user is admin
      if (req.user?.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Only administrators can view SIN numbers",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { sinEncrypted: true },
      });

      if (!user || !user.sinEncrypted) {
        return res.status(404).json({
          success: false,
          error: "Employee or SIN not found",
        });
      }

      const decryptedSIN = decryptSIN(user.sinEncrypted);

      res.json({
        success: true,
        data: { sin: decryptedSIN },
      });
    } catch (error) {
      console.error("Error fetching employee SIN:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
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

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      // Role-based filtering
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      if (userRole === "ADMIN") {
        // ADMIN can see MANAGER and EMPLOYEE roles
        where.role = {
          in: ["MANAGER", "EMPLOYEE"],
        };
      } else if (userRole === "MANAGER") {
        // MANAGER can only see EMPLOYEE roles
        where.role = "EMPLOYEE";
      } else if (userRole === "EMPLOYEE") {
        // EMPLOYEE can only see their own profile
        where.id = currentUserId;
      } else {
        // No valid role - return empty result
        return res.json({
          employees: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        });
      }

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

      // Get users with relations
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { [sortBy as string]: sortOrder },
          include: {
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
        prisma.user.count({ where }),
      ]);

      const formattedEmployees = users.map((user) =>
        formatEmployeeResponse(user, req.user?.role, req.user?.userId)
      );

      const response: EmployeeListResponse = {
        employees: formattedEmployees,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
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

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
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

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Employee not found",
        });
      }

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: formatEmployeeResponse(user, req.user?.role, req.user?.userId),
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

      // Check role permissions: MANAGER can only create EMPLOYEE role
      if (req.user?.role === "MANAGER" && employeeData.role === "MANAGER") {
        return res.status(403).json({
          success: false,
          error: "Managers can only create employees with EMPLOYEE role",
        });
      }

      // Generate employee number
      const employeeNumber = generateEmployeeNumber();

      // Encrypt SIN
      const sinEncrypted = encryptSIN(employeeData.sin);

      // Create user with employee data
      const user = await prisma.user.create({
        data: {
          email: employeeData.email,
          passwordHash: "", // Will be set when user first logs in
          role: employeeData.role || "EMPLOYEE",
          status: "ACTIVE",
          failedLoginAttempts: 0,
          passwordResetRequired: true,
          // Employee information
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
          dateOfBirth: employeeData.dateOfBirth,
          hireDate: employeeData.hireDate,
          payRate: employeeData.payRate || 0,
          payType: employeeData.payType,
          departmentId: employeeData.departmentId,
          positionId: employeeData.positionId,
          managerId: employeeData.managerId || null,
          emergencyContactName: employeeData.emergencyContactName,
          emergencyContactPhone: employeeData.emergencyContactPhone,
          notes: employeeData.notes,
        },
        include: {
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
        data: formatEmployeeResponse(user, req.user?.role, req.user?.userId),
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
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
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
      if (updateData.email !== undefined)
        updatePayload.email = updateData.email;
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
        updatePayload.dateOfBirth = updateData.dateOfBirth;
      if (updateData.hireDate !== undefined)
        updatePayload.hireDate = updateData.hireDate;
      if (updateData.payRate !== undefined)
        updatePayload.payRate = updateData.payRate || 0;
      if (updateData.payType !== undefined)
        updatePayload.payType = updateData.payType;
      if (updateData.departmentId !== undefined)
        updatePayload.departmentId = updateData.departmentId;
      if (updateData.positionId !== undefined)
        updatePayload.positionId = updateData.positionId;
      if (updateData.managerId !== undefined)
        updatePayload.managerId = updateData.managerId || null;
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

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: updatePayload,
        include: {
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

      // Email is already updated in the main update above

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: formatEmployeeResponse(user, req.user?.role, req.user?.userId),
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
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Employee not found",
        });
      }

      // Soft delete - update status to TERMINATED and INACTIVE
      await prisma.user.update({
        where: { id },
        data: { status: "TERMINATED" },
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
