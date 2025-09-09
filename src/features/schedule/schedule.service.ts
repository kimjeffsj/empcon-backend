import { PrismaClient } from "@prisma/client";
import {
  CreateScheduleRequest,
  UpdateScheduleRequest,
  BulkCreateScheduleRequest,
  BulkCreateScheduleResponse,
  GetSchedulesParams,
  Schedule,
  GetSchedulesResponse,
  ConflictCheckRequest,
  ConflictCheckResponse,
  TodayRosterResponse,
  GracePeriodResult,
} from "@empcon/types";

const prisma = new PrismaClient();

export class ScheduleService {
  // Time utilities for UTC/Local conversion
  static combineDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
  }

  static toUTCDateTime(dateTimeStr: string): Date {
    return new Date(dateTimeStr);
  }

  // Grace Period logic (for future TimeEntry integration)
  static applyGracePeriod(
    scheduledTime: Date,
    actualTime: Date,
    gracePeriodMinutes: number = 5
  ): GracePeriodResult {
    const timeDiffMs = Math.abs(actualTime.getTime() - scheduledTime.getTime());
    const gracePeriodMs = gracePeriodMinutes * 60 * 1000;
    const withinGracePeriod = timeDiffMs <= gracePeriodMs;

    return {
      originalTime: actualTime,
      adjustedTime: withinGracePeriod ? scheduledTime : actualTime,
      gracePeriodApplied: withinGracePeriod,
      withinGracePeriod,
    };
  }

  // Conflict Detection
  static async checkScheduleConflicts(
    request: ConflictCheckRequest
  ): Promise<ConflictCheckResponse> {
    const { employeeId, startTime, endTime, excludeScheduleId } = request;

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    // Find overlapping schedules for the same employee
    const conflictingSchedules = await prisma.schedule.findMany({
      where: {
        employeeId,
        isActive: true,
        NOT: excludeScheduleId ? { id: excludeScheduleId } : undefined,
        OR: [
          // New schedule starts during existing schedule
          {
            AND: [
              { startTime: { lte: startDateTime } },
              { endTime: { gt: startDateTime } },
            ],
          },
          // New schedule ends during existing schedule
          {
            AND: [
              { startTime: { lt: endDateTime } },
              { endTime: { gte: endDateTime } },
            ],
          },
          // New schedule completely contains existing schedule
          {
            AND: [
              { startTime: { gte: startDateTime } },
              { endTime: { lte: endDateTime } },
            ],
          },
          // Existing schedule completely contains new schedule
          {
            AND: [
              { startTime: { lte: startDateTime } },
              { endTime: { gte: endDateTime } },
            ],
          },
        ],
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    const conflicts = conflictingSchedules.map((schedule) => {
      // Calculate overlap in minutes
      const overlapStart = new Date(Math.max(startDateTime.getTime(), schedule.startTime.getTime()));
      const overlapEnd = new Date(Math.min(endDateTime.getTime(), schedule.endTime.getTime()));
      const overlapMinutes = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));

      return {
        id: schedule.id,
        startTime: schedule.startTime.toISOString(),
        endTime: schedule.endTime.toISOString(),
        overlapMinutes: Math.floor(overlapMinutes),
      };
    });

    return {
      hasConflict: conflicts.length > 0,
      conflictingSchedules: conflicts,
    };
  }

  // Schedule response formatting
  static formatScheduleResponse(schedule: any): Schedule {
    return {
      id: schedule.id,
      employeeId: schedule.employeeId,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      breakDuration: schedule.breakDuration,
      position: schedule.position ?? undefined,
      status: schedule.status,
      notes: schedule.notes ?? undefined,
      isActive: schedule.isActive,
      createdBy: schedule.createdBy,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      employee: schedule.employee ? {
        id: schedule.employee.id,
        firstName: schedule.employee.firstName ?? undefined,
        lastName: schedule.employee.lastName ?? undefined,
        employeeNumber: schedule.employee.employeeNumber ?? undefined,
      } : undefined,
      creator: schedule.creator ? {
        id: schedule.creator.id,
        firstName: schedule.creator.firstName ?? undefined,
        lastName: schedule.creator.lastName ?? undefined,
      } : undefined,
    };
  }

  // Get schedules with filtering
  static async getSchedules(
    params: GetSchedulesParams,
    userRole: string,
    currentUserId: string
  ): Promise<GetSchedulesResponse> {
    const {
      employeeId,
      startDate,
      endDate,
      status,
      includeInactive = false,
      page = 1,
      limit = 20,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: includeInactive ? undefined : true,
    };

    // Role-based filtering
    if (userRole === "EMPLOYEE") {
      // Employees can only see their own schedules
      where.employeeId = currentUserId;
    } else if (employeeId) {
      // Admin/Manager can filter by specific employee
      where.employeeId = employeeId;
    }

    // Date range filtering
    if (startDate && endDate) {
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      endDateTime.setUTCHours(23, 59, 59, 999); // End of day

      where.AND = [
        { startTime: { gte: startDateTime } },
        { startTime: { lte: endDateTime } },
      ];
    } else if (startDate) {
      where.startTime = { gte: new Date(startDate) };
    } else if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setUTCHours(23, 59, 59, 999);
      where.startTime = { lte: endDateTime };
    }

    if (status) {
      where.status = status;
    }

    // Get schedules with relations
    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { startTime: 'asc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.schedule.count({ where }),
    ]);

    const formattedSchedules = schedules.map(this.formatScheduleResponse);

    return {
      data: formattedSchedules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get schedule by ID
  static async getScheduleById(id: string): Promise<Schedule> {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new Error("Schedule not found");
    }

    return this.formatScheduleResponse(schedule);
  }

  // Create schedule
  static async createSchedule(
    data: CreateScheduleRequest,
    createdBy: string
  ): Promise<Schedule> {
    const startTime = this.toUTCDateTime(data.startTime);
    const endTime = this.toUTCDateTime(data.endTime);

    // Check for conflicts
    const conflictCheck = await this.checkScheduleConflicts({
      employeeId: data.employeeId,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    if (conflictCheck.hasConflict) {
      throw new Error(`Schedule conflict detected: ${conflictCheck.conflictingSchedules.length} overlapping schedule(s)`);
    }

    // Verify employee exists
    const employee = await prisma.user.findUnique({
      where: { id: data.employeeId },
      select: { id: true, role: true },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (!["EMPLOYEE", "MANAGER"].includes(employee.role)) {
      throw new Error("Only EMPLOYEE and MANAGER roles can have schedules");
    }

    const schedule = await prisma.schedule.create({
      data: {
        employeeId: data.employeeId,
        startTime,
        endTime,
        breakDuration: data.breakDuration || 0,
        position: data.position,
        notes: data.notes,
        createdBy,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.formatScheduleResponse(schedule);
  }

  // Update schedule
  static async updateSchedule(
    id: string,
    data: UpdateScheduleRequest
  ): Promise<Schedule> {
    // Check if schedule exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      throw new Error("Schedule not found");
    }

    // Prepare update data
    const updateData: any = {};

    if (data.startTime !== undefined) {
      updateData.startTime = this.toUTCDateTime(data.startTime);
    }
    if (data.endTime !== undefined) {
      updateData.endTime = this.toUTCDateTime(data.endTime);
    }
    if (data.breakDuration !== undefined) {
      updateData.breakDuration = data.breakDuration;
    }
    if (data.position !== undefined) {
      updateData.position = data.position;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Check for conflicts if time is being updated
    if (data.startTime || data.endTime) {
      const startTime = data.startTime || existingSchedule.startTime.toISOString();
      const endTime = data.endTime || existingSchedule.endTime.toISOString();

      const conflictCheck = await this.checkScheduleConflicts({
        employeeId: existingSchedule.employeeId,
        startTime,
        endTime,
        excludeScheduleId: id,
      });

      if (conflictCheck.hasConflict) {
        throw new Error(`Schedule conflict detected: ${conflictCheck.conflictingSchedules.length} overlapping schedule(s)`);
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.formatScheduleResponse(schedule);
  }

  // Delete (soft delete) schedule
  static async deleteSchedule(id: string): Promise<void> {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // Soft delete by setting isActive to false
    await prisma.schedule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Bulk create schedules
  static async bulkCreateSchedules(
    data: BulkCreateScheduleRequest,
    createdBy: string
  ): Promise<BulkCreateScheduleResponse> {
    const { date, schedules } = data;
    const created: Schedule[] = [];
    const errors: Array<{ employeeId: string; error: string }> = [];

    // Process each schedule
    for (const scheduleData of schedules) {
      try {
        // Combine date with time
        const startDateTime = this.combineDateTime(date, scheduleData.startTime);
        const endDateTime = this.combineDateTime(date, scheduleData.endTime);

        // Handle next-day shifts (e.g., 23:00 to 07:00)
        if (endDateTime <= startDateTime) {
          endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
        }

        const schedule = await this.createSchedule(
          {
            employeeId: scheduleData.employeeId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            breakDuration: scheduleData.breakDuration,
            position: scheduleData.position,
            notes: scheduleData.notes,
          },
          createdBy
        );

        created.push(schedule);
      } catch (error) {
        errors.push({
          employeeId: scheduleData.employeeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { created, errors };
  }

  // Get today's roster for dashboard
  static async getTodayRoster(): Promise<TodayRosterResponse> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const schedules = await prisma.schedule.findMany({
      where: {
        isActive: true,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const currentTime = new Date();

    const rosterSchedules = schedules.map((schedule) => ({
      id: schedule.id,
      employee: {
        id: schedule.employee.id,
        firstName: schedule.employee.firstName ?? undefined,
        lastName: schedule.employee.lastName ?? undefined,
        employeeNumber: schedule.employee.employeeNumber ?? undefined,
      },
      startTime: schedule.startTime.toISOString(),
      endTime: schedule.endTime.toISOString(),
      position: schedule.position ?? undefined,
      status: schedule.status,
      isCurrentlyWorking: currentTime >= schedule.startTime && currentTime <= schedule.endTime,
    }));

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalScheduled: schedules.length,
      schedules: rosterSchedules,
    };
  }
}