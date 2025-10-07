import prisma from "@/config/database.config";
import {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from "@empcon/types";

export class DepartmentService {
  // Department response formatting
  static formatDepartmentResponse(dept: any) {
    return {
      id: dept.id,
      name: dept.name,
      description: dept.description,
      managerId: dept.managerId,
      employeeCount: dept._count.employees,
      createdAt: dept.createdAt.toISOString(),
      updatedAt: dept.updatedAt.toISOString(),
      manager: dept.manager
        ? {
            id: dept.manager.id,
            firstName: dept.manager.firstName,
            lastName: dept.manager.lastName,
          }
        : null,
    };
  }

  // Business logic methods
  static async getDepartments() {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            employees: true,
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
      orderBy: {
        name: "asc",
      },
    });

    return departments.map((dept) => this.formatDepartmentResponse(dept));
  }

  static async getDepartmentById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
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

    if (!department) {
      throw new Error("Department not found");
    }

    return this.formatDepartmentResponse(department);
  }

  static async createDepartment(departmentData: CreateDepartmentRequest, createdBy: string) {
    const department = await prisma.department.create({
      data: {
        name: departmentData.name,
        description: departmentData.description,
        managerId: departmentData.managerId || null,
        createdBy,
      },
      include: {
        _count: {
          select: {
            employees: true,
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

    return this.formatDepartmentResponse(department);
  }

  static async updateDepartment(id: string, updateData: UpdateDepartmentRequest) {
    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      throw new Error("Department not found");
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: updateData.name || existingDepartment.name,
        description:
          updateData.description !== undefined
            ? updateData.description
            : existingDepartment.description,
        managerId:
          updateData.managerId !== undefined
            ? updateData.managerId
            : existingDepartment.managerId,
      },
      include: {
        _count: {
          select: {
            employees: true,
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

    return this.formatDepartmentResponse(department);
  }

  static async deleteDepartment(id: string) {
    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    // Check if department has employees
    if (department._count.employees > 0) {
      throw new Error("Cannot delete department with active employees");
    }

    await prisma.department.delete({
      where: { id },
    });
  }
}