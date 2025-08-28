import { Request, Response } from "express";
import { PositionService } from "./position.service";
import {
  CreatePositionRequest,
  UpdatePositionRequest,
  ApiResponse,
} from "@empcon/types";

export const positionController = {
  // GET /api/positions
  async getPositions(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;

      const positions = await PositionService.getPositions(departmentId as string);

      const response: ApiResponse = {
        success: true,
        data: positions,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  // GET /api/positions/:id
  async getPositionById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const position = await PositionService.getPositionById(id);

      const response: ApiResponse = {
        success: true,
        data: position,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching position:", error);
      if (error instanceof Error && error.message === "Position not found") {
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

  // POST /api/positions
  async createPosition(req: Request, res: Response) {
    try {
      const positionData: CreatePositionRequest = req.body;
      const createdBy = req.user?.userId || "";

      const position = await PositionService.createPosition(positionData, createdBy);

      const response: ApiResponse = {
        success: true,
        data: position,
        message: "Position created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating position:", error);
      if (error instanceof Error && error.message === "Department not found") {
        return res.status(400).json({
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

  // PUT /api/positions/:id
  async updatePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdatePositionRequest = req.body;

      const position = await PositionService.updatePosition(id, updateData);

      const response: ApiResponse = {
        success: true,
        data: position,
        message: "Position updated successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error updating position:", error);
      if (error instanceof Error) {
        const status = 
          error.message === "Position not found" ? 404 :
          error.message === "Department not found" ? 400 : 500;
        
        return res.status(status).json({
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

  // DELETE /api/positions/:id
  async deletePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await PositionService.deletePosition(id);

      const response: ApiResponse = {
        success: true,
        message: "Position deleted successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error deleting position:", error);
      if (error instanceof Error) {
        const status = 
          error.message === "Position not found" ? 404 :
          error.message === "Cannot delete position with active employees" ? 400 : 500;
        
        return res.status(status).json({
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
};