import { Request, Response } from "express";
import { DepartmentService } from "./department.service";
import {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  ApiResponse,
} from "@empcon/types";

export const departmentController = {
  // GET /api/departments
  async getDepartments(req: Request, res: Response) {
    try {
      const departments = await DepartmentService.getDepartments();

      const response: ApiResponse = {
        success: true,
        data: departments,
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

      const department = await DepartmentService.getDepartmentById(id);

      const response: ApiResponse = {
        success: true,
        data: department,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching department:", error);
      if (error instanceof Error && error.message === "Department not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
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
      const createdBy = req.user?.userId || "";

      const department = await DepartmentService.createDepartment(departmentData, createdBy);

      const response: ApiResponse = {
        success: true,
        data: department,
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

      const department = await DepartmentService.updateDepartment(id, updateData);

      const response: ApiResponse = {
        success: true,
        data: department,
        message: "Department updated successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error updating department:", error);
      if (error instanceof Error && error.message === "Department not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
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

      await DepartmentService.deleteDepartment(id);

      const response: ApiResponse = {
        success: true,
        message: "Department deleted successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error deleting department:", error);
      if (error instanceof Error) {
        const status = 
          error.message === "Department not found" ? 404 :
          error.message === "Cannot delete department with active employees" ? 400 : 500;
        
        return res.status(status).json({
          success: false,
          error: error.message,
        });
      }
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};