import { Router } from 'express';
import { departmentController } from './department.controller';
import { authMiddleware, requireAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createDepartmentSchema,
  updateDepartmentSchema
} from '@empcon/types';

const router = Router();

// All department routes require authentication
router.use(authMiddleware);

// GET /api/departments - Get all departments
router.get('/', departmentController.getDepartments);

// GET /api/departments/:id - Get department by ID
router.get('/:id', departmentController.getDepartmentById);

// POST /api/departments - Create new department (ADMIN only)
router.post(
  '/',
  requireAdmin,
  validateRequest(createDepartmentSchema),
  departmentController.createDepartment
);

// PUT /api/departments/:id - Update department (ADMIN only)
router.put(
  '/:id',
  requireAdmin,
  validateRequest(updateDepartmentSchema),
  departmentController.updateDepartment
);

// DELETE /api/departments/:id - Delete department (ADMIN only)
router.delete(
  '/:id',
  requireAdmin,
  departmentController.deleteDepartment
);

export default router;