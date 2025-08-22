import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  ApiResponse,
} from "@empcon/types";

const prisma = new PrismaClient();

export const departmentController = {
  // GET /api/departments
  async getDepartments(req: Request, res: Response) {
    try {
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

      const formattedDepartments = departments.map((dept) => ({
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
      }));

      const response: ApiResponse = {
        success: true,
        data: formattedDepartments,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/departments/:id
  async getDepartmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

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
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
      }

      const formattedDepartment = {
        id: department.id,
        name: department.name,
        description: department.description,
        managerId: department.managerId,
        employeeCount: department._count.employees,
        createdAt: department.createdAt.toISOString(),
        updatedAt: department.updatedAt.toISOString(),
        manager: department.manager
          ? {
              id: department.manager.id,
              firstName: department.manager.firstName,
              lastName: department.manager.lastName,
            }
          : null,
      };

      const response: ApiResponse = {
        success: true,
        data: formattedDepartment,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // POST /api/departments
  async createDepartment(req: Request, res: Response) {
    try {
      const departmentData: CreateDepartmentRequest = req.body;

      const department = await prisma.department.create({
        data: {
          name: departmentData.name,
          description: departmentData.description,
          managerId: departmentData.managerId || null,
          createdBy: req.user?.userId || "", // From auth middleware
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

      const formattedDepartment = {
        id: department.id,
        name: department.name,
        description: department.description,
        managerId: department.managerId,
        employeeCount: department._count.employees,
        createdAt: department.createdAt.toISOString(),
        updatedAt: department.updatedAt.toISOString(),
        manager: department.manager
          ? {
              id: department.manager.id,
              firstName: department.manager.firstName,
              lastName: department.manager.lastName,
            }
          : null,
      };

      const response: ApiResponse = {
        success: true,
        data: formattedDepartment,
        message: "Department created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // PUT /api/departments/:id
  async updateDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdateDepartmentRequest = req.body;

      // Check if department exists
      const existingDepartment = await prisma.department.findUnique({
        where: { id },
      });

      if (!existingDepartment) {
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
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

      const formattedDepartment = {
        id: department.id,
        name: department.name,
        description: department.description,
        managerId: department.managerId,
        employeeCount: department._count.employees,
        createdAt: department.createdAt.toISOString(),
        updatedAt: department.updatedAt.toISOString(),
        manager: department.manager
          ? {
              id: department.manager.id,
              firstName: department.manager.firstName,
              lastName: department.manager.lastName,
            }
          : null,
      };

      const response: ApiResponse = {
        success: true,
        data: formattedDepartment,
        message: "Department updated successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // DELETE /api/departments/:id
  async deleteDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params;

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
        return res.status(404).json({
          success: false,
          error: "Department not found",
        });
      }

      // Check if department has employees
      if (department._count.employees > 0) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete department with active employees",
        });
      }

      await prisma.department.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: "Department deleted successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};
