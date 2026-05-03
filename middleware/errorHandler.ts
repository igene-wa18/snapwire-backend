import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from '../utils/errors.ts';
import { getEnvConfig } from '../utils/env.ts';

const config = getEnvConfig();

export function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction) {
  console.error('[Error]', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(config.NODE_ENV === 'development' && err.context && { context: err.context }),
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      ...(config.NODE_ENV === 'development' && { details: err }),
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      code: ErrorCodes.INVALID_TOKEN,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: ErrorCodes.TOKEN_EXPIRED,
      message: 'Token expired',
    });
  }

  // Handle MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      success: false,
      code: ErrorCodes.DATABASE_ERROR,
      message: 'Database error occurred',
      ...(config.NODE_ENV === 'development' && { details: err.message }),
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    message: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(config.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
