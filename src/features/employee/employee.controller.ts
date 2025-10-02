import { Request, Response } from "express";
import { EmployeeService } from "./employee.service";
import { catchAsync } from "../../middleware/errorHandler.middleware";
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeListRequest,
  EmployeeResponse,
  ApiResponse,
} from "@empcon/types";

export const employeeController = {
  // GET /api/employees/validate/email - Check email availability
  validateEmail: catchAsync(async (req: Request, res: Response) => {
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
  }),

  // GET /api/employees/validate/employee-number - Check employee number availability
  validateEmployeeNumber: catchAsync(async (req: Request, res: Response) => {
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
  }),

  // GET /api/employees/:id/sin - Get employee SIN (ADMIN & MANAGER only)
  getEmployeeSIN: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userRole = req.user!.role;

    // Check if user has permission (ADMIN or MANAGER)
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
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
  }),

  // GET /api/employees
  getEmployees: catchAsync(async (req: Request, res: Response) => {
    const query = req.query as Partial<EmployeeListRequest>;
    const userRole = req.user!.role;
    const currentUserId = req.user!.userId;

    const result = await EmployeeService.getEmployees(query, userRole, currentUserId);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }),

  // GET /api/employees/:id
  getEmployeeById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userRole = req.user!.role;
    const currentUserId = req.user!.userId;

    const employee = await EmployeeService.getEmployeeById(
      id,
      userRole,
      currentUserId
    );

    const response: ApiResponse<EmployeeResponse> = {
      success: true,
      data: employee,
    };

    res.json(response);
  }),

  // POST /api/employees
  createEmployee: catchAsync(async (req: Request, res: Response) => {
    const employeeData: CreateEmployeeRequest = req.body;
    const userRole = req.user!.role;

    const employee = await EmployeeService.createEmployee(employeeData, userRole);

    const response: ApiResponse<EmployeeResponse> = {
      success: true,
      data: employee,
      message: "Employee created successfully",
    };

    res.status(201).json(response);
  }),

  // PUT /api/employees/:id
  updateEmployee: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateEmployeeRequest = req.body;
    const userRole = req.user!.role;
    const currentUserId = req.user!.userId;

    const employee = await EmployeeService.updateEmployee(
      id,
      updateData,
      userRole,
      currentUserId
    );

    const response: ApiResponse<EmployeeResponse> = {
      success: true,
      data: employee,
      message: "Employee updated successfully",
    };

    res.json(response);
  }),

  // DELETE /api/employees/:id
  deleteEmployee: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    await EmployeeService.deleteEmployee(id);

    const response: ApiResponse = {
      success: true,
      message: "Employee deleted successfully",
    };

    res.json(response);
  }),
};