import { Request, Response } from "express";
import { ScheduleService } from "./schedule.service";
import { catchAsync } from "../../middleware/errorHandler.middleware";
import {
  ApiResponse,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  BulkCreateScheduleRequest,
  GetSchedulesParams,
  ConflictCheckRequest,
} from "@empcon/types";

export const scheduleController = {
  // GET /api/schedules/conflicts - Check schedule conflicts
  checkConflicts: catchAsync(async (req: Request, res: Response) => {
    const { employeeId, startTime, endTime, excludeScheduleId } = req.query;

    if (!employeeId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "employeeId, startTime, and endTime are required",
      });
    }

    const conflictRequest: ConflictCheckRequest = {
      employeeId: employeeId as string,
      startTime: startTime as string,
      endTime: endTime as string,
      excludeScheduleId: excludeScheduleId as string | undefined,
    };

    const result = await ScheduleService.checkScheduleConflicts(
      conflictRequest
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),

  // GET /api/schedules/today-roster - Get today's schedule roster for dashboard
  getTodayRoster: catchAsync(async (req: Request, res: Response) => {
    const roster = await ScheduleService.getTodayRoster();

    const response: ApiResponse<typeof roster> = {
      success: true,
      data: roster,
    };

    res.json(response);
  }),

  // GET /api/schedules - Get schedules with filtering and pagination
  getSchedules: catchAsync(async (req: Request, res: Response) => {
    const userRole = req.user!.role;
    const currentUserId = req.user!.userId;

    const queryParams: GetSchedulesParams = {
      employeeId: req.query.employeeId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as any | undefined,
      includeInactive: req.query.includeInactive === "true",
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await ScheduleService.getSchedules(
      queryParams,
      userRole,
      currentUserId
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }),

  // GET /api/schedules/:id - Get schedule by ID
  getScheduleById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userRole = req.user!.role;
    const currentUserId = req.user!.userId;

    const schedule = await ScheduleService.getScheduleById(id);

    // Role-based access control
    if (userRole === "EMPLOYEE" && schedule.employeeId !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: "You can only view your own schedules",
      });
    }

    const response: ApiResponse<typeof schedule> = {
      success: true,
      data: schedule,
    };

    res.json(response);
  }),

  // POST /api/schedules - Create schedule
  createSchedule: catchAsync(async (req: Request, res: Response) => {
    const currentUserId = req.user!.userId;

    const scheduleData = req.body as CreateScheduleRequest;
    const schedule = await ScheduleService.createSchedule(
      scheduleData,
      currentUserId
    );

    const response: ApiResponse<typeof schedule> = {
      success: true,
      data: schedule,
      message: "Schedule created successfully",
    };

    res.status(201).json(response);
  }),

  // PUT /api/schedules/:id - Update schedule
  updateSchedule: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body as UpdateScheduleRequest;
    const schedule = await ScheduleService.updateSchedule(id, updateData);

    const response: ApiResponse<typeof schedule> = {
      success: true,
      data: schedule,
      message: "Schedule updated successfully",
    };

    res.json(response);
  }),

  // DELETE /api/schedules/:id - Delete (soft delete) schedule
  deleteSchedule: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await ScheduleService.deleteSchedule(id);

    const response: ApiResponse<null> = {
      success: true,
      message: "Schedule deleted successfully",
      data: null,
    };

    res.json(response);
  }),

  // POST /api/schedules/bulk - Bulk create schedules
  bulkCreateSchedules: catchAsync(async (req: Request, res: Response) => {
    const currentUserId = req.user!.userId;

    const bulkData = req.body as BulkCreateScheduleRequest;
    const result = await ScheduleService.bulkCreateSchedules(
      bulkData,
      currentUserId
    );

    // Return 207 Multi-Status if there are partial errors
    const statusCode = result.errors.length > 0 ? 207 : 201;

    const response: ApiResponse<typeof result> = {
      success: result.errors.length === 0,
      data: result,
      message:
        result.errors.length === 0
          ? "All schedules created successfully"
          : `${result.created.length} schedules created, ${result.errors.length} failed`,
    };

    res.status(statusCode).json(response);
  }),
};
