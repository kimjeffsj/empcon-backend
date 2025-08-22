import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    next();
  };
};

export const validateRequest = (schema: Joi.ObjectSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
    const { error } = schema.validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    next();
  };
};
