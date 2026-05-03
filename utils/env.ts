import dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRE: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  SOCKET_IO_CORS_ORIGIN: string;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

function getEnvVariable(key: keyof EnvConfig, defaultValue?: string | number): string | number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export function getEnvConfig(): EnvConfig {
  return {
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    PORT: parseInt(getEnvVariable('PORT', 3000) as string, 10),
    HOST: getEnvVariable('HOST', '0.0.0.0') as string,
    MONGODB_URI: getEnvVariable('MONGODB_URI') as string,
    JWT_SECRET: getEnvVariable('JWT_SECRET') as string,
    JWT_EXPIRE: getEnvVariable('JWT_EXPIRE', '7d') as string,
    JWT_REFRESH_SECRET: getEnvVariable('JWT_REFRESH_SECRET') as string,
    JWT_REFRESH_EXPIRE: getEnvVariable('JWT_REFRESH_EXPIRE', '30d') as string,
    CORS_ORIGIN: getEnvVariable('CORS_ORIGIN', 'http://localhost:3001') as string,
    RATE_LIMIT_WINDOW_MS: parseInt(getEnvVariable('RATE_LIMIT_WINDOW_MS', 900000) as string, 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(getEnvVariable('RATE_LIMIT_MAX_REQUESTS', 100) as string, 10),
    SOCKET_IO_CORS_ORIGIN: getEnvVariable('SOCKET_IO_CORS_ORIGIN', 'http://localhost:3001') as string,
    LOG_LEVEL: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'debug',
  };
}
