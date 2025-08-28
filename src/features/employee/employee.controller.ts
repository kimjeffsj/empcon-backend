import { Request, Response } from "express";
import { EmployeeService } from "./employee.service";
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeListRequest,
  EmployeeResponse,
  ApiResponse,
} from "@empcon/types";

export const employeeController = {
  // GET /api/employees/validate/email - Check email availability
  async validateEmail(req: Request, res: Response) {
    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          success: false,
          error: "Email parameter is required",
        });
      }

      const result = await EmployeeService.validateEmail(email);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error validating email:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/employees/validate/employee-number - Check employee number availability
  async validateEmployeeNumber(req: Request, res: Response) {
    try {
      const { number } = req.query;

      if (!number || typeof number !== "string") {
        return res.status(400).json({
          success: false,
          error: "Employee number parameter is required",
        });
      }

      const result = await EmployeeService.validateEmployeeNumber(number);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error validating employee number:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/employees/:id/sin - Get employee SIN (ADMIN & MANAGER only)
  async getEmployeeSIN(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if user has permission (ADMIN or MANAGER)
      if (req.user?.role !== "ADMIN" && req.user?.role !== "MANAGER") {
        return res.status(403).json({
          success: false,
          error: "Only administrators and managers can view SIN numbers",
        });
      }

      const sin = await EmployeeService.getEmployeeSIN(id);

      res.json({
        success: true,
        data: { sin },
      });
    } catch (error) {
      console.error("Error fetching employee SIN:", error);
      if (error instanceof Error && error.message === "Employee or SIN not found") {
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

  // GET /api/employees
  async getEmployees(req: Request, res: Response) {
    try {
      const query = req.query as Partial<EmployeeListRequest>;
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      if (!userRole || !currentUserId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const response = await EmployeeService.getEmployees(query, userRole, currentUserId);

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

      const employee = await EmployeeService.getEmployeeById(
        id,
        req.user?.role,
        req.user?.userId
      );

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: employee,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching employee:", error);
      if (error instanceof Error && error.message === "Employee not found") {
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

  // POST /api/employees
  async createEmployee(req: Request, res: Response) {
    try {
      const employeeData: CreateEmployeeRequest = req.body;
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const employee = await EmployeeService.createEmployee(employeeData, userRole);

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: employee,
        message: "Employee created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating employee:", error);
      if (error instanceof Error) {
        return res.status(400).json({
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

  // PUT /api/employees/:id
  async updateEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdateEmployeeRequest = req.body;

      const employee = await EmployeeService.updateEmployee(
        id,
        updateData,
        req.user?.role,
        req.user?.userId
      );

      const response: ApiResponse<EmployeeResponse> = {
        success: true,
        data: employee,
        message: "Employee updated successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error updating employee:", error);
      if (error instanceof Error && error.message === "Employee not found") {
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

  // DELETE /api/employees/:id
  async deleteEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await EmployeeService.deleteEmployee(id);

      const response: ApiResponse = {
        success: true,
        message: "Employee deleted successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error deleting employee:", error);
      if (error instanceof Error && error.message === "Employee not found") {
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
};