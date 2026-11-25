import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/expensesplit.db'),
  API_KEY: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  CORS_ORIGINS: z.string().default('*'),
  DEFAULT_CURRENCY: z.string().length(3).toUpperCase().default('USD'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  ENABLE_DEMO_SEED: z
    .string()
    .default('true')
    .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())),
  ENABLE_HSTS: z
    .string()
    .default('false')
    .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message instead of booting in a half-configured state.
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databasePath:
    env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(ROOT_DIR, env.DATABASE_PATH),
  apiKey: env.API_KEY,
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  defaultCurrency: env.DEFAULT_CURRENCY,
  logLevel: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  enableDemoSeed: env.ENABLE_DEMO_SEED,
  enableHsts: env.ENABLE_HSTS,
  clientDistDir: path.join(ROOT_DIR, 'client', 'dist'),
});
