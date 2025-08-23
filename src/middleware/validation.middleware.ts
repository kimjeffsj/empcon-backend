import { Request, Response, NextFunction } from "express";

export const validateBody = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.issues.map((issue: any) => issue.message),
      });
    }

    next();
  };
};

export const validateParams = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.issues.map((issue: any) => issue.message),
      });
    }

    next();
  };
};

export const validateQuery = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.issues.map((issue: any) => issue.message),
      });
    }

    next();
  };
};

export const validateRequest = (schema: any, target: 'body' | 'query' | 'params' = 'body') => {
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

    const result = schema.safeParse(data);

    if (!result.success) {
      console.error(`❌ [ValidationMiddleware] Validation failed for ${target}:`, {
        url: req.originalUrl,
        method: req.method,
        errors: result.error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
          value: issue.code
        })),
        receivedData: target === 'body' ? 
          { ...data, sin: data.sin ? '[REDACTED]' : undefined } : 
          data
      });
      
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.issues.map((issue: any) => issue.message),
      });
    }

    console.log(`✅ [ValidationMiddleware] Validation passed for ${target}:`, {
      url: req.originalUrl,
      method: req.method
    });

    next();
  };
};
