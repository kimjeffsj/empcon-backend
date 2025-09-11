import { Request, Response } from "express";
import { PositionService } from "./position.service";
import { catchAsync } from "../../middleware/errorHandler.middleware";
import {
  CreatePositionRequest,
  UpdatePositionRequest,
  ApiResponse,
} from "@empcon/types";

export const positionController = {
  // GET /api/positions
  getPositions: catchAsync(async (req: Request, res: Response) => {
    const { departmentId } = req.query;

    const positions = await PositionService.getPositions(departmentId as string);

    const response: ApiResponse = {
      success: true,
      data: positions,
    };

    res.json(response);
  }),

  // GET /api/positions/:id
  getPositionById: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const position = await PositionService.getPositionById(id);

    const response: ApiResponse = {
      success: true,
      data: position,
    };

    res.json(response);
  }),

  // POST /api/positions
  createPosition: catchAsync(async (req: Request, res: Response) => {
    const positionData: CreatePositionRequest = req.body;
    const createdBy = req.user!.userId;

    const position = await PositionService.createPosition(positionData, createdBy);

    const response: ApiResponse = {
      success: true,
      data: position,
      message: "Position created successfully",
    };

    res.status(201).json(response);
  }),

  // PUT /api/positions/:id
  updatePosition: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdatePositionRequest = req.body;

    const position = await PositionService.updatePosition(id, updateData);

    const response: ApiResponse = {
      success: true,
      data: position,
      message: "Position updated successfully",
    };

    res.json(response);
  }),

  // DELETE /api/positions/:id
  deletePosition: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    await PositionService.deletePosition(id);

    const response: ApiResponse = {
      success: true,
      message: "Position deleted successfully",
    };

    res.json(response);
  }),
};