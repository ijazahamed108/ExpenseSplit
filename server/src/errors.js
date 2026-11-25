/**
 * Application error with an HTTP status and a stable machine-readable code.
 * Thrown from services; translated to JSON by the error-handler middleware.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
export const unprocessable = (message, details) =>
  new AppError(422, 'UNPROCESSABLE', message, details);
