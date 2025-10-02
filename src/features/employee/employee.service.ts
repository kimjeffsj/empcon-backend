import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeListRequest,
  EmployeeResponse,
  PaginatedResponse,
} from "@empcon/types";

const prisma = new PrismaClient();

// Encryption for SIN
const ENCRYPTION_KEY =
  process.env.SIN_ENCRYPTION_KEY || "your-32-character-secret-key-here"; // Should be 32 characters
const ALGORITHM = "aes-256-cbc";

export class EmployeeService {
  // SIN Encryption utilities
  static encryptSIN(sin: string): string {
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

  static decryptSIN(encryptedSIN: string): string {
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

  static createMaskedSIN(encryptedSIN: string): string {
    try {
      const decrypted = this.decryptSIN(encryptedSIN);
      const cleaned = decrypted.replace(/\D/g, "");
      if (cleaned.length >= 9) {
        const lastThree = cleaned.slice(-3);
        return `xxx-xxx-${lastThree}`;
      }
      return "xxx-xxx-xxx";
    } catch (error) {
      return "xxx-xxx-xxx";
    }
  }

  // Employee number generation
  static generateEmployeeNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `EMP${timestamp}${random}`;
  }

  // Employee response formatting
  static formatEmployeeResponse(
    user: any,
    userRole?: string,
    currentUserId?: string
  ): EmployeeResponse {
    // Determine if user has permission to see SIN existence
    let canSeeSINInfo = false;
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      canSeeSINInfo = true;
    } else if (
      userRole === "EMPLOYEE" &&
      currentUserId &&
      user.id === currentUserId
    ) {
      canSeeSINInfo = true; // Employee can see their own SIN info
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

    // Add masked SIN if user has permission and SIN exists
    if (canSeeSINInfo && user.sinEncrypted) {
      try {
        response.sinMasked = this.createMaskedSIN(user.sinEncrypted);
        response.hasSIN = true;
      } catch (error) {
        console.error("Error creating masked SIN:", error);
        response.hasSIN = false;
      }
    } else {
      response.hasSIN = !!user.sinEncrypted;
    }

    return response;
  }

  // Business logic methods
  static async validateEmail(email: string): Promise<{ available: boolean; message: string }> {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    return {
      available: !existingUser,
      message: existingUser
        ? "Email is already in use"
        : "Email is available",
    };
  }

  static async validateEmployeeNumber(number: string): Promise<{ available: boolean; message: string }> {
    const existingUser = await prisma.user.findFirst({
      where: { employeeNumber: number },
      select: { id: true, employeeNumber: true },
    });

    return {
      available: !existingUser,
      message: existingUser
        ? "Employee number is already in use"
        : "Employee number is available",
    };
  }

  static async getEmployeeSIN(id: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { sinEncrypted: true },
    });

    if (!user || !user.sinEncrypted) {
      throw new Error("Employee or SIN not found");
    }

    return this.decryptSIN(user.sinEncrypted);
  }

  static async getEmployees(
    query: Partial<EmployeeListRequest>,
    userRole: string,
    currentUserId: string
  ): Promise<PaginatedResponse<EmployeeResponse>> {
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
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Role-based filtering
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
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
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
      this.formatEmployeeResponse(user, userRole, currentUserId)
    );

    return {
      data: formattedEmployees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getEmployeeById(
    id: string,
    userRole?: string,
    currentUserId?: string
  ): Promise<EmployeeResponse> {
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
      throw new Error("Employee not found");
    }

    return this.formatEmployeeResponse(user, userRole, currentUserId);
  }

  static async createEmployee(
    employeeData: CreateEmployeeRequest,
    userRole: string
  ): Promise<EmployeeResponse> {
    // Check role permissions: MANAGER can only create EMPLOYEE role
    if (userRole === "MANAGER" && employeeData.role === "MANAGER") {
      throw new Error("Managers can only create employees with EMPLOYEE role");
    }

    // Generate employee number
    const employeeNumber = this.generateEmployeeNumber();

    // Encrypt SIN
    const sinEncrypted = this.encryptSIN(employeeData.sin);

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

    return this.formatEmployeeResponse(user, userRole);
  }

  static async updateEmployee(
    id: string,
    updateData: UpdateEmployeeRequest,
    userRole?: string,
    currentUserId?: string
  ): Promise<EmployeeResponse> {
    // Check if employee exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new Error("Employee not found");
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
    if (updateData.role !== undefined)
      updatePayload.role = updateData.role;
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
      updatePayload.sinEncrypted = this.encryptSIN(updateData.sin);
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

    return this.formatEmployeeResponse(user, userRole, currentUserId);
  }

  static async deleteEmployee(id: string): Promise<void> {
    // Check if employee exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("Employee not found");
    }

    // Soft delete - update status to TERMINATED
    await prisma.user.update({
      where: { id },
      data: { status: "TERMINATED" },
    });
  }
}