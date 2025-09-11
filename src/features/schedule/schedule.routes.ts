import { Router } from 'express';
import { scheduleController } from './schedule.controller';
import { authMiddleware, requireManager } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  CreateScheduleRequestSchema,
  UpdateScheduleRequestSchema,
  BulkCreateScheduleRequestSchema,
  GetSchedulesParamsSchema,
  ConflictCheckRequestSchema,
} from '@empcon/types';

const router = Router();

// All schedule routes require authentication
router.use(authMiddleware);

// GET /api/schedules/conflicts - Check schedule conflicts
router.get(
  '/conflicts',
  validateRequest(ConflictCheckRequestSchema, 'query'),
  scheduleController.checkConflicts
);

// GET /api/schedules/today-roster - Get today's roster for dashboard
router.get('/today-roster', scheduleController.getTodayRoster);

// GET /api/schedules - Get schedules with filtering and pagination
router.get(
  '/',
  validateRequest(GetSchedulesParamsSchema, 'query'),
  scheduleController.getSchedules
);

// GET /api/schedules/:id - Get schedule by ID
router.get('/:id', scheduleController.getScheduleById);

// POST /api/schedules/bulk - Bulk create schedules (ADMIN & MANAGER only)
router.post(
  '/bulk',
  requireManager,
  validateRequest(BulkCreateScheduleRequestSchema),
  scheduleController.bulkCreateSchedules
);

// POST /api/schedules - Create schedule (ADMIN & MANAGER only)
router.post(
  '/',
  requireManager,
  validateRequest(CreateScheduleRequestSchema),
  scheduleController.createSchedule
);

// PUT /api/schedules/:id - Update schedule (ADMIN & MANAGER only)
router.put(
  '/:id',
  requireManager,
  validateRequest(UpdateScheduleRequestSchema),
  scheduleController.updateSchedule
);

// DELETE /api/schedules/:id - Delete schedule (ADMIN & MANAGER only)
router.delete(
  '/:id',
  requireManager,
  scheduleController.deleteSchedule
);

export default router;