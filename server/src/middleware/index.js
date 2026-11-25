import { ZodError } from 'zod';
import { AppError, unauthorized } from '../errors.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Validate `req.body`, `req.params` and/or `req.query` against zod schemas.
 * Parsed (and coerced) values replace the originals so handlers get typed data.
 */
export const validate =
  ({ body, params, query } = {}) =>
  (req, _res, next) => {
    try {
      if (params) req.params = params.parse(req.params);
      if (query) req.query = query.parse(req.query);
      if (body) req.body = body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };

/** Optional shared-secret auth. Active only when API_KEY is configured. */
export const apiKeyAuth = (req, _res, next) => {
  if (!config.apiKey) return next();
  const header = req.get('x-api-key');
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (header === config.apiKey || bearer === config.apiKey) return next();
  next(unauthorized('Missing or invalid API key'));
};

/** Wrap async route handlers so rejections reach the error handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
};

// Express identifies error middleware by arity, so the 4th parameter must stay.
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  }

  // SQLite constraint violations surface as generic errors; map the common ones.
  if (/UNIQUE constraint failed/i.test(err?.message)) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these values already exists' } });
  }
  if (/FOREIGN KEY constraint failed/i.test(err?.message)) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Operation violates a reference to another record' } });
  }

  logger.error({ err, reqId: req.id }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
