import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
          },
        });
      }
    }
  };
}

/**
 * Validation middleware for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedQuery = await schema.parseAsync(req.query);
      req.query = validatedQuery as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.issues,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
          },
        });
      }
    }
  };
}
