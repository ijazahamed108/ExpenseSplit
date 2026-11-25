import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb, initDb } from './db/connection.js';
import { logger } from './logger.js';

initDb();
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, `ExpenseSplit listening on http://localhost:${config.port}`);
});

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Force exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'unhandled rejection');
  shutdown('unhandledRejection');
});
