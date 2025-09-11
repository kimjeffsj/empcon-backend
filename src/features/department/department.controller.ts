import { Request, Response } from "express";
import { DepartmentService } from "./department.service";
import { catchAsync } from "../../middleware/errorHandler.middleware";
import {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  ApiResponse,
} from "@empcon/types";

export const departmentController = {
  // GET /api/departments
  getDepartments: catchAsync(async (req: Request, res: Response) => {
    const departments = await DepartmentService.getDepartments();

    const response: ApiResponse = {
      success: true,
      data: departments,
    };

    res.json(response);
  }),

  // GET /api/departments/:id
  getDepartmentById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const department = await DepartmentService.getDepartmentById(id);

    const response: ApiResponse = {
      success: true,
      data: department,
    };

    res.json(response);
  }),

  // POST /api/departments
  createDepartment: catchAsync(async (req: Request, res: Response) => {
    const departmentData: CreateDepartmentRequest = req.body;
    const createdBy = req.user!.userId;

    const department = await DepartmentService.createDepartment(departmentData, createdBy);

    const response: ApiResponse = {
      success: true,
      data: department,
      message: "Department created successfully",
    };

    res.status(201).json(response);
  }),

  // PUT /api/departments/:id
  updateDepartment: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateDepartmentRequest = req.body;

    const department = await DepartmentService.updateDepartment(id, updateData);

    const response: ApiResponse = {
      success: true,
      data: department,
      message: "Department updated successfully",
    };

    res.json(response);
  }),

  // DELETE /api/departments/:id
  deleteDepartment: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    await DepartmentService.deleteDepartment(id);

    const response: ApiResponse = {
      success: true,
      message: "Department deleted successfully",
    };

    res.json(response);
  }),
};