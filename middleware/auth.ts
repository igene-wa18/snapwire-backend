import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { createAuthError } from '../utils/errors.js';
import User from '../models/User.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw createAuthError('No token provided');
    }

    const payload = verifyAccessToken(token);
    
    // Verify user still exists
    const user = await User.findById(payload.userId);
    if (!user) {
      throw createAuthError('User not found');
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message,
    });
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verifyAccessToken(token);
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };
    }
  } catch (error) {
    // Silently ignore auth errors for optional auth
  }
  next();
}
