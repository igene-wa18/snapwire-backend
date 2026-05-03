export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ErrorCodes = {
  // Auth Errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Chat Errors
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  NOT_CHAT_PARTICIPANT: 'NOT_CHAT_PARTICIPANT',
  CHAT_ALREADY_EXISTS: 'CHAT_ALREADY_EXISTS',

  // Message Errors
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CANNOT_DELETE_MESSAGE: 'CANNOT_DELETE_MESSAGE',
  CANNOT_EDIT_MESSAGE: 'CANNOT_EDIT_MESSAGE',

  // Group Errors
  NOT_GROUP_ADMIN: 'NOT_GROUP_ADMIN',
  CANNOT_REMOVE_LAST_ADMIN: 'CANNOT_REMOVE_LAST_ADMIN',
  INVALID_GROUP_OPERATION: 'INVALID_GROUP_OPERATION',

  // Validation Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Server Errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

export function createAuthError(message: string, context?: Record<string, unknown>) {
  return new AppError(401, ErrorCodes.UNAUTHORIZED, message, context);
}

export function createNotFoundError(resource: string, context?: Record<string, unknown>) {
  return new AppError(404, ErrorCodes[`${resource}_NOT_FOUND` as keyof typeof ErrorCodes] || 'NOT_FOUND', `${resource} not found`, context);
}

export function createValidationError(message: string, context?: Record<string, unknown>) {
  return new AppError(400, ErrorCodes.VALIDATION_ERROR, message, context);
}

export function createForbiddenError(message: string, code: string = 'FORBIDDEN', context?: Record<string, unknown>) {
  return new AppError(403, code, message, context);
}

export function createInternalError(message: string, context?: Record<string, unknown>) {
  return new AppError(500, ErrorCodes.INTERNAL_SERVER_ERROR, message, context);
}
