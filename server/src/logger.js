import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  base: { service: 'expensesplit' },
  redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
});
