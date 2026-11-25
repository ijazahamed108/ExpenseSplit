import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config } from './config.js';
import { getDb } from './db/connection.js';
import { logger } from './logger.js';
import { apiKeyAuth, errorHandler, notFoundHandler } from './middleware/index.js';
import { apiV1 } from './routes/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // The SPA and Swagger UI are served from this origin; allow inline styles/scripts they need.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          // Only meaningful behind TLS; enabling them on plain-HTTP demos breaks the browser.
          upgradeInsecureRequests: config.enableHsts ? [] : null,
        },
      },
      hsts: config.enableHsts,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
      autoLogging: { ignore: (req) => req.url === '/api/health' || !req.url.startsWith('/api') },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );

  // ---- Public endpoints ----
  app.get('/api/health', (_req, res) => {
    try {
      getDb().prepare('SELECT 1').get();
      res.json({ status: 'ok', uptime: Math.round(process.uptime()), version: process.env.npm_package_version ?? '2.0.0' });
    } catch (err) {
      res.status(503).json({ status: 'degraded', error: err.message });
    }
  });

  const openapiPath = path.join(here, 'docs', 'openapi.yaml');
  const openapi = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'ExpenseSplit API' }));

  // ---- Versioned API ----
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: config.rateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } },
    }),
  );
  app.use('/api/v1', apiKeyAuth, apiV1);
  app.use('/api', notFoundHandler);

  // ---- Static client (production build) ----
  if (fs.existsSync(config.clientDistDir)) {
    app.use(express.static(config.clientDistDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.clientDistDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) =>
      res
        .type('text')
        .send('ExpenseSplit API is running. Client build not found: run `npm run build` (or use `npm run dev`). API docs: /api/docs'),
    );
  }

  app.use(errorHandler);
  return app;
}
