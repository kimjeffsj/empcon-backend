import { Router } from 'express';
import { timeClockController } from './timeClock.controller';
import { authMiddleware, requireManager } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  ClockInRequestSchema,
  ClockOutRequestSchema,
  ClockStatusRequestSchema,
  ClockStatusQuerySchema,
  GetTimeEntriesParamsSchema,
  TimeAdjustmentRequestSchema,
  TimeEntryIdParamSchema,
  EmployeeIdParamSchema,
} from '@empcon/types';

const router = Router();

// All timeclock routes require authentication
router.use(authMiddleware);

// Development-only testing routes (authentication required)
if (process.env.NODE_ENV === 'development') {
  // GET /api/timeclock/test-rounding - Test payroll rounding logic
  router.get('/test-rounding', timeClockController.testRounding);
  
  // GET /api/timeclock/test-grace-period - Test grace period logic
  router.get('/test-grace-period', timeClockController.testGracePeriod);
}

// POST /api/timeclock/clock-in - Employee clock-in
router.post(
  '/clock-in',
  validateRequest(ClockInRequestSchema),
  timeClockController.clockIn
);

// POST /api/timeclock/clock-out - Employee clock-out
router.post(
  '/clock-out',
  validateRequest(ClockOutRequestSchema),
  timeClockController.clockOut
);

// GET /api/timeclock/status/:employeeId - Current clock status
router.get(
  '/status/:employeeId',
  validateRequest(EmployeeIdParamSchema, 'params'),
  validateRequest(ClockStatusQuerySchema, 'query'),
  timeClockController.getClockStatus
);

// GET /api/timeclock/entries - Get time entries with filtering
router.get(
  '/entries',
  validateRequest(GetTimeEntriesParamsSchema, 'query'),
  timeClockController.getTimeEntries
);

// GET /api/timeclock/today-entries - Get today's time entries for dashboard
router.get('/today-entries', timeClockController.getTodayTimeEntries);

// PUT /api/timeclock/entries/:id - Manual time adjustment (Admin/Manager only)
router.put(
  '/entries/:id',
  requireManager,
  validateRequest(TimeEntryIdParamSchema, 'params'),
  validateRequest(TimeAdjustmentRequestSchema),
  timeClockController.adjustTimeEntry
);


export default router;