/* CLI: `npm run backup [-- /path/to/backup.db]` — consistent online backup via VACUUM INTO. */
import path from 'node:path';
process.env.LOG_LEVEL ??= 'warn'; // keep CLI output human-readable
const { config } = await import('./config.js');
const { closeDb, initDb } = await import('./db/connection.js');

const dest = process.argv[2] ?? path.join(path.dirname(config.databasePath), `backup-${new Date().toISOString().slice(0, 10)}.db`);

const db = initDb();
try {
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  console.log(`Backup written to ${dest}`);
} catch (err) {
  console.error(`Backup failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  closeDb();
}
