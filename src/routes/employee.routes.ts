import { Router } from 'express';
import { employeeController } from '../controllers/employeeController';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeListQuerySchema
} from '../schemas/employee.schemas';

const router = Router();

// All employee routes require authentication
router.use(authMiddleware);

// GET /api/employees - Get all employees with filtering/pagination
router.get(
  '/',
  validateRequest(employeeListQuerySchema, 'query'),
  employeeController.getEmployees
);

// GET /api/employees/:id - Get employee by ID
router.get('/:id', employeeController.getEmployeeById);

// POST /api/employees - Create new employee (ADMIN only)
router.post(
  '/',
  (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can create employees'
      });
    }
    next();
  },
  validateRequest(createEmployeeSchema),
  employeeController.createEmployee
);

// PUT /api/employees/:id - Update employee (ADMIN only)
router.put(
  '/:id',
  (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can update employees'
      });
    }
    next();
  },
  validateRequest(updateEmployeeSchema),
  employeeController.updateEmployee
);

// DELETE /api/employees/:id - Delete employee (ADMIN only)
router.delete(
  '/:id',
  (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete employees'
      });
    }
    next();
  },
  employeeController.deleteEmployee
);

export default router;