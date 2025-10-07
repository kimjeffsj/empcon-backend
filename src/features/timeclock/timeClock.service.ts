import prisma from "@/config/database.config";
import {
  TimeEntry,
  ClockInRequest,
  ClockOutRequest,
  ClockInResponse,
  ClockOutResponse,
  ClockStatusRequest,
  ClockStatusResponse,
  GetTimeEntriesParams,
  GetTimeEntriesResponse,
  TimeAdjustmentRequest,
  TimeAdjustmentResponse,
  PayrollRoundingResult,
  TimeClockGracePeriodResult,
  TIMECLOCK_ERROR_MESSAGES,
  DEFAULT_TIMECLOCK_RULES,
} from "@empcon/types";
import { DateTimeUtils } from "@/utils/dateTime.utils";

export class TimeClockService {
  // 15-minute payroll rounding logic
  static applyPayrollRounding(dateTime: Date): PayrollRoundingResult {
    const originalMinutes = dateTime.getMinutes();
    let roundedMinutes: number;

    // Rounding rules: 0-7→0, 8-22→15, 23-37→30, 38-52→45, 53-59→60(next hour)
    if (originalMinutes <= 7) {
      roundedMinutes = 0;
    } else if (originalMinutes <= 22) {
      roundedMinutes = 15;
    } else if (originalMinutes <= 37) {
      roundedMinutes = 30;
    } else if (originalMinutes <= 52) {
      roundedMinutes = 45;
    } else {
      roundedMinutes = 60; // Next hour
    }

    const roundedTime = new Date(dateTime);

    if (roundedMinutes === 60) {
      // Move to next hour
      roundedTime.setHours(roundedTime.getHours() + 1);
      roundedTime.setMinutes(0);
    } else {
      roundedTime.setMinutes(roundedMinutes);
    }

    // Always set seconds and milliseconds to 0 for payroll
    roundedTime.setSeconds(0);
    roundedTime.setMilliseconds(0);

    return {
      originalMinutes,
      roundedMinutes: roundedMinutes === 60 ? 0 : roundedMinutes,
      originalTime: dateTime.toISOString(),
      roundedTime: roundedTime.toISOString(),
    };
  }

  // Grace period logic (5 minutes before/after scheduled time)
  static applyGracePeriod(
    actualTime: Date,
    scheduledTime: Date,
    gracePeriodMinutes: number = DEFAULT_TIMECLOCK_RULES.gracePeriodMinutes
  ): TimeClockGracePeriodResult {
    const timeDiffMs = Math.abs(actualTime.getTime() - scheduledTime.getTime());
    const gracePeriodMs = gracePeriodMinutes * 60 * 1000;
    const withinGracePeriod = timeDiffMs <= gracePeriodMs;

    return {
      originalTime: actualTime.toISOString(),
      adjustedTime: withinGracePeriod
        ? scheduledTime.toISOString()
        : actualTime.toISOString(),
      gracePeriodApplied: withinGracePeriod,
      withinGracePeriod,
    };
  }

  // Validate clock-in operation
  static async validateClockInOperation(
    employeeId: string,
    scheduleId: string
  ): Promise<{ isValid: boolean; error?: string; schedule?: any }> {
    // 1. Check if schedule exists and is active
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
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
    });

    if (!schedule) {
      return {
        isValid: false,
        error: TIMECLOCK_ERROR_MESSAGES.SCHEDULE_NOT_FOUND,
      };
    }

    if (!schedule.isActive) {
      return { isValid: false, error: "Schedule is inactive" };
    }

    // 2. Verify employee matches schedule
    if (schedule.employeeId !== employeeId) {
      return { isValid: false, error: "Employee ID does not match schedule" };
    }

    // 3. Check if schedule is for today or tomorrow (for night shifts)
    const now = new Date();
    const scheduleStart = new Date(schedule.startTime);
    // const timeDiff = scheduleStart.getTime() - now.getTime();
    // const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Allow clock-in up to 5 minutes before schedule start time
    const allowedClockInTime = new Date(
      scheduleStart.getTime() -
        DEFAULT_TIMECLOCK_RULES.clockInWindowMinutes * 60 * 1000
    );

    if (now < allowedClockInTime) {
      return {
        isValid: false,
        error: TIMECLOCK_ERROR_MESSAGES.TOO_EARLY,
        schedule,
      };
    }

    // 4. Check if already clocked in for this schedule
    const existingTimeEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId,
        scheduleId,
        clockOutTime: null, // Still clocked in
      },
    });

    if (existingTimeEntry) {
      return {
        isValid: false,
        error: TIMECLOCK_ERROR_MESSAGES.ALREADY_CLOCKED_IN,
      };
    }

    return { isValid: true, schedule };
  }

  // Clock-in operation
  static async clockIn(
    request: ClockInRequest,
    clientIp?: string
  ): Promise<ClockInResponse> {
    const { employeeId, scheduleId, clockInLocation } = request;

    // Validate clock-in operation
    const validation = await this.validateClockInOperation(
      employeeId,
      scheduleId
    );
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const schedule = validation.schedule;
    const actualClockInTime = new Date();
    const scheduledStartTime = new Date(schedule.startTime);

    // Apply grace period
    const gracePeriodResult = this.applyGracePeriod(
      actualClockInTime,
      scheduledStartTime
    );

    // Create time entry
    const timeEntry = await prisma.timeEntry.create({
      data: {
        employeeId,
        scheduleId,
        clockInTime: actualClockInTime,
        clockInLocation,
        clockInIp: clientIp,
        scheduledStartTime,
        scheduledEndTime: new Date(schedule.endTime),
        adjustedStartTime: new Date(gracePeriodResult.adjustedTime),
        gracePeriodApplied: gracePeriodResult.gracePeriodApplied,
        status: "CLOCKED_IN",
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
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
    });

    return {
      timeEntry: this.formatTimeEntryResponse(timeEntry),
      message: gracePeriodResult.gracePeriodApplied
        ? "Clocked in successfully (on-time with grace period)"
        : "Clocked in successfully",
      gracePeriodInfo: gracePeriodResult.gracePeriodApplied
        ? {
            originalClockInTime: gracePeriodResult.originalTime,
            adjustedClockInTime: gracePeriodResult.adjustedTime,
            gracePeriodApplied: true,
          }
        : undefined,
    };
  }

  // Clock-out operation
  static async clockOut(
    request: ClockOutRequest,
    clientIp?: string,
    currentUserId?: string,
    userRole?: string
  ): Promise<ClockOutResponse> {
    const { timeEntryId, clockOutLocation } = request;

    // Find existing time entry
    const existingTimeEntry = await prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
    });

    if (!existingTimeEntry) {
      throw new Error(TIMECLOCK_ERROR_MESSAGES.TIME_ENTRY_NOT_FOUND);
    }

    // Permission check for employees
    if (
      userRole === "EMPLOYEE" &&
      existingTimeEntry.employeeId !== currentUserId
    ) {
      throw new Error("You can only clock out your own time entries");
    }

    if (existingTimeEntry.clockOutTime) {
      throw new Error("Already clocked out for this shift");
    }

    const actualClockOutTime = new Date();
    const scheduledEndTime = existingTimeEntry.scheduledEndTime
      ? new Date(existingTimeEntry.scheduledEndTime)
      : new Date(existingTimeEntry.schedule!.endTime);

    // Apply grace period for clock-out
    const gracePeriodResult = this.applyGracePeriod(
      actualClockOutTime,
      scheduledEndTime
    );

    // Calculate working time using adjusted times
    const adjustedStartTime = existingTimeEntry.adjustedStartTime
      ? new Date(existingTimeEntry.adjustedStartTime)
      : new Date(existingTimeEntry.clockInTime);

    const adjustedEndTime = new Date(gracePeriodResult.adjustedTime);

    // Apply payroll rounding to both start and end times
    const startRounding = this.applyPayrollRounding(adjustedStartTime);
    const endRounding = this.applyPayrollRounding(adjustedEndTime);

    // Calculate total minutes worked (after rounding)
    const roundedStart = new Date(startRounding.roundedTime);
    const roundedEnd = new Date(endRounding.roundedTime);
    const totalMinutesWorked =
      (roundedEnd.getTime() - roundedStart.getTime()) / (1000 * 60);
    const finalHours = Math.max(0, totalMinutesWorked / 60); // Ensure non-negative

    // Calculate overtime (if applicable)
    const regularHours = Math.min(
      finalHours,
      DEFAULT_TIMECLOCK_RULES.overtimeThresholdHours
    );
    const overtimeHours = Math.max(
      0,
      finalHours - DEFAULT_TIMECLOCK_RULES.overtimeThresholdHours
    );

    // Update time entry
    const updatedTimeEntry = await prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: {
        clockOutTime: actualClockOutTime,
        clockOutLocation,
        clockOutIp: clientIp,
        adjustedEndTime: adjustedEndTime,
        gracePeriodApplied:
          existingTimeEntry.gracePeriodApplied ||
          gracePeriodResult.gracePeriodApplied,
        totalHours: finalHours,
        overtimeHours: overtimeHours > 0 ? overtimeHours : null,
        status: "CLOCKED_OUT",
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
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
    });

    // Check if clocking out significantly early
    const scheduledEndTimeMs = scheduledEndTime.getTime();
    const actualEndTimeMs = actualClockOutTime.getTime();
    const earlyByMinutes = (scheduledEndTimeMs - actualEndTimeMs) / (1000 * 60);

    let message = "Clocked out successfully";
    if (earlyByMinutes > 30) {
      message = TIMECLOCK_ERROR_MESSAGES.EARLY_CLOCKOUT;
    } else if (gracePeriodResult.gracePeriodApplied) {
      message = "Clocked out successfully (on-time with grace period)";
    }

    return {
      timeEntry: this.formatTimeEntryResponse(updatedTimeEntry),
      message,
      payrollInfo: {
        totalMinutesWorked: Math.round(totalMinutesWorked),
        roundedMinutes: Math.round(finalHours * 60),
        finalHours: Math.round(finalHours * 100) / 100, // Round to 2 decimal places
        overtimeHours:
          overtimeHours > 0 ? Math.round(overtimeHours * 100) / 100 : undefined,
      },
      gracePeriodInfo: gracePeriodResult.gracePeriodApplied
        ? {
            originalClockOutTime: gracePeriodResult.originalTime,
            adjustedClockOutTime: gracePeriodResult.adjustedTime,
            gracePeriodApplied: true,
          }
        : undefined,
    };
  }

  // Get clock status for employee
  static async getClockStatus(
    request: ClockStatusRequest
  ): Promise<ClockStatusResponse> {
    const { employeeId, date } = request;

    // Determine target date (default to today)
    const targetDate = date ? new Date(date) : new Date();
    const { startOfDay, endOfDay } =
      DateTimeUtils.setUTCDayBoundaries(targetDate);

    // Get today's schedules for this employee
    const todaySchedules = await prisma.schedule.findMany({
      where: {
        employeeId,
        isActive: true,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        timeEntries: {
          where: {
            employeeId,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    // Get current active time entry (if any)
    const currentTimeEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId,
        clockOutTime: null, // Still clocked in
        clockInTime: {
          gte: startOfDay,
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
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
    });

    // Calculate today's worked hours
    const completedTimeEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        clockInTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        clockOutTime: { not: null },
      },
    });

    const hoursWorkedToday = completedTimeEntries.reduce((total, entry) => {
      return total + (entry.totalHours ? Number(entry.totalHours) : 0);
    }, 0);

    // Process schedules and determine clock-in eligibility
    const now = new Date();
    const processedSchedules = todaySchedules.map((schedule) => {
      const scheduleStart = new Date(schedule.startTime);
      const allowedClockInTime = new Date(
        scheduleStart.getTime() -
          DEFAULT_TIMECLOCK_RULES.clockInWindowMinutes * 60 * 1000
      );
      const existingTimeEntry = schedule.timeEntries.find(
        (te) => te.employeeId === employeeId
      );

      return {
        id: schedule.id,
        startTime: schedule.startTime.toISOString(),
        endTime: schedule.endTime.toISOString(),
        position: schedule.position ?? undefined,
        status: schedule.status,
        canClockIn: !existingTimeEntry && now >= allowedClockInTime,
        timeEntryId: existingTimeEntry?.id,
      };
    });

    return {
      employeeId,
      isClocked: !!currentTimeEntry,
      currentTimeEntry: currentTimeEntry
        ? this.formatTimeEntryResponse(currentTimeEntry)
        : undefined,
      todaySchedules: processedSchedules,
      summary: {
        date: targetDate.toISOString().split("T")[0],
        totalSchedules: todaySchedules.length,
        completedShifts: completedTimeEntries.length,
        hoursWorkedToday: Math.round(hoursWorkedToday * 100) / 100,
      },
    };
  }

  // Get time entries with filtering
  static async getTimeEntries(
    params: GetTimeEntriesParams,
    userRole: string,
    currentUserId: string
  ): Promise<GetTimeEntriesResponse> {
    const {
      employeeId,
      startDate,
      endDate,
      status,
      scheduleId,
      page = 1,
      limit = 20,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Role-based filtering
    if (userRole === "EMPLOYEE") {
      // Employees can only see their own time entries
      where.employeeId = currentUserId;
    } else if (employeeId) {
      // Admin/Manager can filter by specific employee
      where.employeeId = employeeId;
    }

    // Date range filtering
    if (startDate && endDate) {
      const { startOfDay } = DateTimeUtils.setUTCDayBoundaries(
        new Date(startDate)
      );
      const { endOfDay } = DateTimeUtils.setUTCDayBoundaries(new Date(endDate));

      where.schedule = {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    } else if (startDate) {
      const { startOfDay } = DateTimeUtils.setUTCDayBoundaries(
        new Date(startDate)
      );
      where.schedule = {
        startTime: { gte: startOfDay },
      };
    } else if (endDate) {
      const { endOfDay } = DateTimeUtils.setUTCDayBoundaries(new Date(endDate));
      where.schedule = {
        startTime: { lte: endOfDay },
      };
    }

    if (status) {
      where.status = status;
    }

    if (scheduleId) {
      where.scheduleId = scheduleId;
    }

    // Get time entries with relations
    const [timeEntries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { clockInTime: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
          schedule: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              position: true,
            },
          },
        },
      }),
      prisma.timeEntry.count({ where }),
    ]);

    const formattedTimeEntries = timeEntries.map(this.formatTimeEntryResponse);

    return {
      data: formattedTimeEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Time adjustment (Admin/Manager only)
  static async adjustTimeEntry(
    request: TimeAdjustmentRequest
  ): Promise<TimeAdjustmentResponse> {
    const { timeEntryId, clockInTime, clockOutTime, reason, adjustedBy } =
      request;

    // Find existing time entry
    const existingTimeEntry = await prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
    });

    if (!existingTimeEntry) {
      throw new Error(TIMECLOCK_ERROR_MESSAGES.TIME_ENTRY_NOT_FOUND);
    }

    // Store original times for audit trail
    const originalClockInTime = existingTimeEntry.clockInTime;
    const originalClockOutTime = existingTimeEntry.clockOutTime;

    // Prepare update data
    const updateData: any = {
      status: "ADJUSTED",
      updatedAt: new Date(),
    };

    // Update clock-in time if provided
    if (clockInTime) {
      const newClockInTime = new Date(clockInTime);
      updateData.clockInTime = newClockInTime;

      // Re-apply grace period if scheduled time exists
      if (existingTimeEntry.scheduledStartTime) {
        const gracePeriodResult = this.applyGracePeriod(
          newClockInTime,
          new Date(existingTimeEntry.scheduledStartTime)
        );
        updateData.adjustedStartTime = new Date(gracePeriodResult.adjustedTime);
        updateData.gracePeriodApplied = gracePeriodResult.gracePeriodApplied;
      }
    }

    // Update clock-out time if provided
    if (clockOutTime) {
      const newClockOutTime = new Date(clockOutTime);
      updateData.clockOutTime = newClockOutTime;

      // Re-apply grace period if scheduled time exists
      if (existingTimeEntry.scheduledEndTime) {
        const gracePeriodResult = this.applyGracePeriod(
          newClockOutTime,
          new Date(existingTimeEntry.scheduledEndTime)
        );
        updateData.adjustedEndTime = new Date(gracePeriodResult.adjustedTime);
        updateData.gracePeriodApplied =
          existingTimeEntry.gracePeriodApplied ||
          gracePeriodResult.gracePeriodApplied;
      }
    }

    // Recalculate total hours if both times are available
    if (
      (clockInTime || existingTimeEntry.clockInTime) &&
      (clockOutTime || existingTimeEntry.clockOutTime)
    ) {
      const finalClockInTime = clockInTime
        ? new Date(clockInTime)
        : existingTimeEntry.clockInTime;
      const finalClockOutTime = clockOutTime
        ? new Date(clockOutTime)
        : existingTimeEntry.clockOutTime!;

      // Apply payroll rounding
      const startRounding = this.applyPayrollRounding(finalClockInTime);
      const endRounding = this.applyPayrollRounding(finalClockOutTime);

      const roundedStart = new Date(startRounding.roundedTime);
      const roundedEnd = new Date(endRounding.roundedTime);
      const totalMinutesWorked =
        (roundedEnd.getTime() - roundedStart.getTime()) / (1000 * 60);
      const finalHours = Math.max(0, totalMinutesWorked / 60);

      // Calculate overtime
      const overtimeHours = Math.max(
        0,
        finalHours - DEFAULT_TIMECLOCK_RULES.overtimeThresholdHours
      );

      updateData.totalHours = finalHours;
      updateData.overtimeHours = overtimeHours > 0 ? overtimeHours : null;
    }

    // Update time entry
    const updatedTimeEntry = await prisma.timeEntry.update({
      where: { id: timeEntryId },
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
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
    });

    // Create audit log record (would be implemented in a real audit system)
    const adjustmentRecord = {
      id: `adj_${Date.now()}`, // In real implementation, this would be a proper UUID
      originalClockInTime: originalClockInTime?.toISOString(),
      originalClockOutTime: originalClockOutTime?.toISOString(),
      newClockInTime: clockInTime,
      newClockOutTime: clockOutTime,
      reason,
      adjustedBy,
      adjustedAt: new Date().toISOString(),
    };

    return {
      timeEntry: this.formatTimeEntryResponse(updatedTimeEntry),
      adjustmentRecord,
      message: "Time entry adjusted successfully",
    };
  }

  // Format TimeEntry for API response
  static formatTimeEntryResponse(timeEntry: any): TimeEntry {
    return {
      id: timeEntry.id,
      employeeId: timeEntry.employeeId,
      scheduleId: timeEntry.scheduleId,
      clockInTime: timeEntry.clockInTime,
      clockOutTime: timeEntry.clockOutTime,
      clockInLocation: timeEntry.clockInLocation,
      clockOutLocation: timeEntry.clockOutLocation,
      clockInIp: timeEntry.clockInIp,
      clockOutIp: timeEntry.clockOutIp,
      scheduledStartTime: timeEntry.scheduledStartTime,
      scheduledEndTime: timeEntry.scheduledEndTime,
      adjustedStartTime: timeEntry.adjustedStartTime,
      adjustedEndTime: timeEntry.adjustedEndTime,
      gracePeriodApplied: timeEntry.gracePeriodApplied,
      totalHours: timeEntry.totalHours
        ? Number(timeEntry.totalHours)
        : undefined,
      overtimeHours: timeEntry.overtimeHours
        ? Number(timeEntry.overtimeHours)
        : undefined,
      status: timeEntry.status,
      createdAt: timeEntry.createdAt,
      updatedAt: timeEntry.updatedAt,
      employee: timeEntry.employee
        ? {
            id: timeEntry.employee.id,
            firstName: timeEntry.employee.firstName ?? undefined,
            lastName: timeEntry.employee.lastName ?? undefined,
            employeeNumber: timeEntry.employee.employeeNumber ?? undefined,
          }
        : undefined,
      schedule: timeEntry.schedule
        ? {
            id: timeEntry.schedule.id,
            startTime: timeEntry.schedule.startTime,
            endTime: timeEntry.schedule.endTime,
            position: timeEntry.schedule.position ?? undefined,
          }
        : undefined,
    };
  }

  // Get today's time entries for dashboard (following Schedule API pattern)
  static async getTodayTimeEntries(): Promise<GetTimeEntriesResponse> {
    const today = new Date();
    const { startOfDay, endOfDay } = DateTimeUtils.setUTCDayBoundaries(today);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        schedule: {
          startTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
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
        schedule: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            position: true,
          },
        },
      },
      orderBy: {
        clockInTime: "desc",
      },
    });

    const formattedEntries = timeEntries.map((entry) =>
      this.formatTimeEntryResponse(entry)
    );

    return {
      data: formattedEntries,
      pagination: {
        page: 1,
        limit: formattedEntries.length,
        total: formattedEntries.length,
        totalPages: 1,
      },
    };
  }
}
