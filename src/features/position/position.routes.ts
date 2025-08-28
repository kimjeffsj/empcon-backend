import { Router } from 'express';
import { positionController } from './position.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  createPositionSchema,
  updatePositionSchema
} from '@empcon/types';

const router = Router();

// All position routes require authentication
router.use(authMiddleware);

// GET /api/positions - Get all positions (with optional department filter)
router.get('/', positionController.getPositions);

// GET /api/positions/:id - Get position by ID
router.get('/:id', positionController.getPositionById);

// POST /api/positions - Create new position (ADMIN only)
router.post(
  '/',
  (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can create positions'
      });
    }
    next();
  },
  validateRequest(createPositionSchema),
  positionController.createPosition
);

// PUT /api/positions/:id - Update position (ADMIN only)
router.put(
  '/:id',
  (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can update positions'
      });
    }
    next();
  },
  validateRequest(updatePositionSchema),
  positionController.updatePosition
);

// DELETE /api/positions/:id - Delete position (ADMIN only)
router.delete(
  '/:id',
  (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete positions'
      });
    }
    next();
  },
  positionController.deletePosition
);

export default router;