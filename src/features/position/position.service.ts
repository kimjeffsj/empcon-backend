import { PrismaClient } from "@prisma/client";
import {
  CreatePositionRequest,
  UpdatePositionRequest,
} from "@empcon/types";

const prisma = new PrismaClient();

export class PositionService {
  // Position response formatting
  static formatPositionResponse(pos: any) {
    return {
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
    };
  }

  // Business logic methods
  static async getPositions(departmentId?: string) {
    const where: any = {};
    if (departmentId) {
      where.departmentId = departmentId;
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

    return positions.map((pos) => this.formatPositionResponse(pos));
  }

  static async getPositionById(id: string) {
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
      throw new Error("Position not found");
    }

    return this.formatPositionResponse(position);
  }

  static async createPosition(positionData: CreatePositionRequest, createdBy: string) {
    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: positionData.departmentId },
    });

    if (!department) {
      throw new Error("Department not found");
    }

    const position = await prisma.position.create({
      data: {
        title: positionData.title,
        departmentId: positionData.departmentId,
        description: positionData.description,
        createdBy,
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

    return this.formatPositionResponse(position);
  }

  static async updatePosition(id: string, updateData: UpdatePositionRequest) {
    // Check if position exists
    const existingPosition = await prisma.position.findUnique({
      where: { id },
    });

    if (!existingPosition) {
      throw new Error("Position not found");
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
        throw new Error("Department not found");
      }
    }

    const position = await prisma.position.update({
      where: { id },
      data: {
        title: updateData.title || existingPosition.title,
        departmentId: updateData.departmentId || existingPosition.departmentId,
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

    return this.formatPositionResponse(position);
  }

  static async deletePosition(id: string) {
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
      throw new Error("Position not found");
    }

    // Check if position has employees
    if (position._count.employees > 0) {
      throw new Error("Cannot delete position with active employees");
    }

    await prisma.position.delete({
      where: { id },
    });
  }
}