import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    fileParallelism: false,
    env: { NODE_ENV: 'test', DATABASE_PATH: ':memory:', API_KEY: '' },
  },
});
