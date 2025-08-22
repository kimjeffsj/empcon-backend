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
    
    console.log(`🔍 [ValidationMiddleware] Validating ${target} data:`, {
      url: req.originalUrl,
      method: req.method,
      dataKeys: Object.keys(data || {}),
      dataPreview: target === 'body' ? 
        { ...data, sin: data.sin ? '[REDACTED]' : undefined } : 
        data
    });

    const { error } = schema.validate(data, { abortEarly: false });

    if (error) {
      console.error(`❌ [ValidationMiddleware] Validation failed for ${target}:`, {
        url: req.originalUrl,
        method: req.method,
        errors: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        receivedData: target === 'body' ? 
          { ...data, sin: data.sin ? '[REDACTED]' : undefined } : 
          data
      });
      
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    console.log(`✅ [ValidationMiddleware] Validation passed for ${target}:`, {
      url: req.originalUrl,
      method: req.method
    });

    next();
  };
};
