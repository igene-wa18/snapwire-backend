import jwt from 'jsonwebtoken';
import { getEnvConfig } from './env.ts';

export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

const config = getEnvConfig();

export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    config.JWT_SECRET as string,
    { expiresIn: config.JWT_EXPIRE as any }
  );
}

export function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    config.JWT_REFRESH_SECRET as string,
    { expiresIn: config.JWT_REFRESH_EXPIRE as any }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, config.JWT_SECRET as string) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET as string) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload | null;
  } catch (error) {
    return null;
  }
}
