import { Router } from 'express';
import { employeeController } from './employee.controller';
import { authMiddleware, requireManager, requireAdmin } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeListQuerySchema
} from '@empcon/types';

const router = Router();

// All employee routes require authentication
router.use(authMiddleware);

// GET /api/employees/validate/email - Check email availability
router.get('/validate/email', employeeController.validateEmail);

// GET /api/employees/validate/employee-number - Check employee number availability  
router.get('/validate/employee-number', employeeController.validateEmployeeNumber);

// GET /api/employees - Get all employees with filtering/pagination
router.get(
  '/',
  validateRequest(employeeListQuerySchema, 'query'),
  employeeController.getEmployees
);

// GET /api/employees/:id - Get employee by ID
router.get('/:id', employeeController.getEmployeeById);

// GET /api/employees/:id/sin - Get employee SIN (ADMIN & MANAGER only)
router.get('/:id/sin', employeeController.getEmployeeSIN);

// POST /api/employees - Create new employee (ADMIN & MANAGER only)
router.post(
  '/',
  requireManager,
  validateRequest(createEmployeeSchema),
  employeeController.createEmployee
);

// PUT /api/employees/:id - Update employee (ADMIN & MANAGER only)
router.put(
  '/:id',
  requireManager,
  validateRequest(updateEmployeeSchema),
  employeeController.updateEmployee
);

// DELETE /api/employees/:id - Delete employee (ADMIN only)
router.delete(
  '/:id',
  requireAdmin,
  employeeController.deleteEmployee
);

export default router;