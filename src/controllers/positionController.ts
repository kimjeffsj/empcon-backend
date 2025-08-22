import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  CreatePositionRequest,
  UpdatePositionRequest,
  ApiResponse,
} from "@empcon/types";

const prisma = new PrismaClient();

export const positionController = {
  // GET /api/positions
  async getPositions(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;

      const where: any = {};
      if (departmentId) {
        where.departmentId = departmentId as string;
      }

      const positions = await prisma.position.findMany({
        where,
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
        orderBy: {
          title: "asc",
        },
      });

      const formattedPositions = positions.map((pos) => ({
        id: pos.id,
        title: pos.title,
        departmentId: pos.departmentId,
        description: pos.description,
        employeeCount: pos._count.employees,
        createdAt: pos.createdAt.toISOString(),
        updatedAt: pos.updatedAt.toISOString(),
        department: {
          id: pos.department.id,
          name: pos.department.name,
        },
      }));

      const response: ApiResponse = {
        success: true,
        data: formattedPositions,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/positions/:id
  async getPositionById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const position = await prisma.position.findUnique({
        where: { id },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

      if (!position) {
        return res.status(404).json({
          success: false,
          error: "Position not found",
        });
      }

      const formattedPosition = {
        id: position.id,
        title: position.title,
        departmentId: position.departmentId,
        description: position.description,
        employeeCount: position._count.employees,
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
        department: {
          id: position.department.id,
          name: position.department.name,
        },
      };

      const response: ApiResponse = {
        success: true,
        data: formattedPosition,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching position:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // POST /api/positions
  async createPosition(req: Request, res: Response) {
    try {
      const positionData: CreatePositionRequest = req.body;

      // Verify department exists
      const department = await prisma.department.findUnique({
        where: { id: positionData.departmentId },
      });

      if (!department) {
        return res.status(400).json({
          success: false,
          error: "Department not found",
        });
      }

      const position = await prisma.position.create({
        data: {
          title: positionData.title,
          departmentId: positionData.departmentId,
          description: positionData.description,
          createdBy: req.user?.userId || "", // From auth middleware
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

      const formattedPosition = {
        id: position.id,
        title: position.title,
        departmentId: position.departmentId,
        description: position.description,
        employeeCount: position._count.employees,
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
        department: {
          id: position.department.id,
          name: position.department.name,
        },
      };

      const response: ApiResponse = {
        success: true,
        data: formattedPosition,
        message: "Position created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating position:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // PUT /api/positions/:id
  async updatePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdatePositionRequest = req.body;

      // Check if position exists
      const existingPosition = await prisma.position.findUnique({
        where: { id },
      });

      if (!existingPosition) {
        return res.status(404).json({
          success: false,
          error: "Position not found",
        });
      }

      // Verify department exists if changing
      if (
        updateData.departmentId &&
        updateData.departmentId !== existingPosition.departmentId
      ) {
        const department = await prisma.department.findUnique({
          where: { id: updateData.departmentId },
        });

        if (!department) {
          return res.status(400).json({
            success: false,
            error: "Department not found",
          });
        }
      }

      const position = await prisma.position.update({
        where: { id },
        data: {
          title: updateData.title || existingPosition.title,
          departmentId:
            updateData.departmentId || existingPosition.departmentId,
          description:
            updateData.description !== undefined
              ? updateData.description
              : existingPosition.description,
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

      const formattedPosition = {
        id: position.id,
        title: position.title,
        departmentId: position.departmentId,
        description: position.description,
        employeeCount: position._count.employees,
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
        department: {
          id: position.department.id,
          name: position.department.name,
        },
      };

      const response: ApiResponse = {
        success: true,
        data: formattedPosition,
        message: "Position updated successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error updating position:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // DELETE /api/positions/:id
  async deletePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if position exists
      const position = await prisma.position.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              employees: true,
            },
          },
        },
      });

      if (!position) {
        return res.status(404).json({
          success: false,
          error: "Position not found",
        });
      }

      // Check if position has employees
      if (position._count.employees > 0) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete position with active employees",
        });
      }

      await prisma.position.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: "Position deleted successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error deleting position:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};
