import { Request, Response } from "express";
import { TimeClockService } from "./timeClock.service";
import { catchAsync } from "../../middleware/errorHandler.middleware";
import {
  ClockInRequest,
  ClockOutRequest,
  ClockStatusRequest,
  GetTimeEntriesParams,
  TimeAdjustmentRequest,
  ApiResponse,
} from "@empcon/types";

export const timeClockController = {
  // POST /api/timeclock/clock-in - Employee clock-in
  clockIn: catchAsync(async (req: Request, res: Response) => {
    const { employeeId, scheduleId, clockInLocation } = req.body;
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Employees can only clock in for themselves
    if (userRole === "EMPLOYEE" && employeeId !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: "You can only clock in for yourself",
      });
    }
    
    const clockInRequest: ClockInRequest = {
      employeeId,
      scheduleId,
      clockInLocation,
    };
    
    // Get client IP for audit trail
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
    
    const result = await TimeClockService.clockIn(clockInRequest, clientIp);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: result.message,
    };

    res.status(201).json(response);
  }),
  
  // POST /api/timeclock/clock-out - Employee clock-out
  clockOut: catchAsync(async (req: Request, res: Response) => {
    const { timeEntryId, clockOutLocation } = req.body;
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;
    
    const clockOutRequest: ClockOutRequest = {
      timeEntryId,
      clockOutLocation,
    };
    
    // Get client IP for audit trail
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
    
    const result = await TimeClockService.clockOut(clockOutRequest, clientIp, currentUserId, userRole);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: result.message,
    };

    res.json(response);
  }),
  
  // GET /api/timeclock/status/:employeeId - Current clock status
  getClockStatus: catchAsync(async (req: Request, res: Response) => {
    const { employeeId } = req.params;
    const { date } = req.query;
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Employees can only see their own status
    if (userRole === "EMPLOYEE" && employeeId !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: "You can only view your own clock status",
      });
    }
    
    const clockStatusRequest: ClockStatusRequest = {
      employeeId,
      date: date as string,
    };
    
    const result = await TimeClockService.getClockStatus(clockStatusRequest);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  }),
  
  // GET /api/timeclock/entries - Get time entries with filtering
  getTimeEntries: catchAsync(async (req: Request, res: Response) => {
    const {
      employeeId,
      startDate,
      endDate,
      status,
      scheduleId,
      page,
      limit,
    } = req.query;
    
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;
    
    const params: GetTimeEntriesParams = {
      employeeId: employeeId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as any,
      scheduleId: scheduleId as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    };
    
    const result = await TimeClockService.getTimeEntries(params, userRole, currentUserId);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }),
  
  // PUT /api/timeclock/entries/:id - Manual time adjustment (Admin/Manager only)
  adjustTimeEntry: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { clockInTime, clockOutTime, reason } = req.body;
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Only Admin/Manager can adjust time entries
    if (!["ADMIN", "MANAGER"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "Only administrators and managers can adjust time entries",
      });
    }
    
    const adjustmentRequest: TimeAdjustmentRequest = {
      timeEntryId: id,
      clockInTime,
      clockOutTime,
      reason,
      adjustedBy: currentUserId,
    };
    
    const result = await TimeClockService.adjustTimeEntry(adjustmentRequest);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: result.message,
    };

    res.json(response);
  }),

  // GET /api/timeclock/today-entries - Get today's time entries for dashboard
  getTodayTimeEntries: catchAsync(async (_req: Request, res: Response) => {
    const result = await TimeClockService.getTodayTimeEntries();

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }),

  // GET /api/timeclock/test-rounding - Test payroll rounding logic (Development only)
  testRounding: catchAsync(async (req: Request, res: Response) => {
    // Only available in development environment
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({
        success: false,
        error: "Endpoint not available in production",
      });
    }
    
    const { time } = req.query;
    if (!time) {
      return res.status(400).json({
        success: false,
        error: "Time parameter is required (ISO string)",
      });
    }
    
    try {
      const testTime = new Date(time as string);
      const result = TimeClockService.applyPayrollRounding(testTime);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: "Payroll rounding test completed",
      };

      res.json(response);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Please use ISO string format.",
      });
    }
  }),
  
  // GET /api/timeclock/test-grace-period - Test grace period logic (Development only)
  testGracePeriod: catchAsync(async (req: Request, res: Response) => {
    // Only available in development environment
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({
        success: false,
        error: "Endpoint not available in production",
      });
    }
    
    const { actualTime, scheduledTime, gracePeriodMinutes } = req.query;
    if (!actualTime || !scheduledTime) {
      return res.status(400).json({
        success: false,
        error: "actualTime and scheduledTime parameters are required (ISO strings)",
      });
    }
    
    try {
      const actual = new Date(actualTime as string);
      const scheduled = new Date(scheduledTime as string);
      const gracePeriod = gracePeriodMinutes ? parseInt(gracePeriodMinutes as string) : undefined;
      
      const result = TimeClockService.applyGracePeriod(actual, scheduled, gracePeriod);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: "Grace period test completed",
      };

      res.json(response);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Please use ISO string format.",
      });
    }
  }),
};