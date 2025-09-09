import { Request, Response } from "express";
import { ScheduleService } from "./schedule.service";
import {
  CreateScheduleRequest,
  UpdateScheduleRequest,
  BulkCreateScheduleRequest,
  GetSchedulesParams,
  ConflictCheckRequest,
  ApiResponse,
} from "@empcon/types";

export const scheduleController = {
  // GET /api/schedules/conflicts - Check schedule conflicts
  async checkConflicts(req: Request, res: Response) {
    try {
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

      const result = await ScheduleService.checkScheduleConflicts(conflictRequest);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error checking schedule conflicts:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/schedules/today-roster - Get today's schedule roster for dashboard
  async getTodayRoster(req: Request, res: Response) {
    try {
      const roster = await ScheduleService.getTodayRoster();

      res.json({
        success: true,
        data: roster,
      });
    } catch (error) {
      console.error("Error fetching today's roster:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/schedules - Get schedules with filtering and pagination
  async getSchedules(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      if (!userRole || !currentUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const queryParams: GetSchedulesParams = {
        employeeId: req.query.employeeId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as any | undefined,
        includeInactive: req.query.includeInactive === 'true',
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await ScheduleService.getSchedules(queryParams, userRole, currentUserId);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching schedules:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/schedules/:id - Get schedule by ID
  async getScheduleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      const schedule = await ScheduleService.getScheduleById(id);

      // Role-based access control
      if (userRole === "EMPLOYEE" && schedule.employeeId !== currentUserId) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own schedules",
        });
      }

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      console.error("Error fetching schedule:", error);
      if (error instanceof Error && error.message === "Schedule not found") {
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

  // POST /api/schedules - Create schedule
  async createSchedule(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      if (!userRole || !currentUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Only ADMIN and MANAGER can create schedules
      if (userRole === "EMPLOYEE") {
        return res.status(403).json({
          success: false,
          error: "Only administrators and managers can create schedules",
        });
      }

      const scheduleData = req.body as CreateScheduleRequest;

      const schedule = await ScheduleService.createSchedule(scheduleData, currentUserId);

      res.status(201).json({
        success: true,
        data: schedule,
        message: "Schedule created successfully",
      });
    } catch (error) {
      console.error("Error creating schedule:", error);
      if (error instanceof Error) {
        if (error.message.includes("conflict detected") || error.message.includes("not found")) {
          return res.status(400).json({
            success: false,
            error: error.message,
          });
        }
      }
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // PUT /api/schedules/:id - Update schedule
  async updateSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Only ADMIN and MANAGER can update schedules
      if (userRole === "EMPLOYEE") {
        return res.status(403).json({
          success: false,
          error: "Only administrators and managers can update schedules",
        });
      }

      const updateData = req.body as UpdateScheduleRequest;

      const schedule = await ScheduleService.updateSchedule(id, updateData);

      res.json({
        success: true,
        data: schedule,
        message: "Schedule updated successfully",
      });
    } catch (error) {
      console.error("Error updating schedule:", error);
      if (error instanceof Error) {
        if (error.message === "Schedule not found") {
          return res.status(404).json({
            success: false,
            error: error.message,
          });
        }
        if (error.message.includes("conflict detected")) {
          return res.status(400).json({
            success: false,
            error: error.message,
          });
        }
      }
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // DELETE /api/schedules/:id - Delete (soft delete) schedule
  async deleteSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Only ADMIN and MANAGER can delete schedules
      if (userRole === "EMPLOYEE") {
        return res.status(403).json({
          success: false,
          error: "Only administrators and managers can delete schedules",
        });
      }

      await ScheduleService.deleteSchedule(id);

      res.json({
        success: true,
        message: "Schedule deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting schedule:", error);
      if (error instanceof Error && error.message === "Schedule not found") {
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

  // POST /api/schedules/bulk - Bulk create schedules
  async bulkCreateSchedules(req: Request, res: Response) {
    try {
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      if (!userRole || !currentUserId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Only ADMIN and MANAGER can bulk create schedules
      if (userRole === "EMPLOYEE") {
        return res.status(403).json({
          success: false,
          error: "Only administrators and managers can bulk create schedules",
        });
      }

      const bulkData = req.body as BulkCreateScheduleRequest;

      const result = await ScheduleService.bulkCreateSchedules(bulkData, currentUserId);

      // Return 207 Multi-Status if there are partial errors
      const statusCode = result.errors.length > 0 ? 207 : 201;

      res.status(statusCode).json({
        success: result.errors.length === 0,
        data: result,
        message: result.errors.length === 0 
          ? "All schedules created successfully"
          : `${result.created.length} schedules created, ${result.errors.length} failed`,
      });
    } catch (error) {
      console.error("Error bulk creating schedules:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};