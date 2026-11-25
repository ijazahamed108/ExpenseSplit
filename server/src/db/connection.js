import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { migrations } from './migrations.js';

let db = null;

/**
 * Open (or create) the SQLite database, apply pragmas and pending migrations.
 * Safe to call multiple times; returns the shared connection.
 */
export function initDb(databasePath = config.databasePath) {
  if (db) return db;

  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  db = new DatabaseSync(databasePath);

  // WAL gives concurrent readers with a single writer and far better write latency.
  // busy_timeout makes writers wait instead of failing when another process holds the lock.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA temp_store = MEMORY;
  `);

  runMigrations(db);
  logger.info({ databasePath }, 'database ready');
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

let txDepth = 0;

/**
 * Run `fn` inside a transaction; rolls back on any thrown error.
 * Nested calls become SAVEPOINTs so services can compose freely.
 */
export function transaction(fn) {
  const conn = getDb();
  const nested = txDepth > 0;
  const savepoint = `sp_${txDepth}`;
  conn.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
  txDepth += 1;
  try {
    const result = fn(conn);
    conn.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
    return result;
  } catch (err) {
    conn.exec(nested ? `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}` : 'ROLLBACK');
    throw err;
  } finally {
    txDepth -= 1;
  }
}

function runMigrations(conn) {
  const { user_version: current } = conn.prepare('PRAGMA user_version').get();
  const pending = migrations.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
  for (const m of pending) {
    conn.exec('BEGIN');
    try {
      conn.exec(m.sql);
      conn.exec(`PRAGMA user_version = ${m.version}`);
      conn.exec('COMMIT');
      logger.info({ version: m.version, name: m.name }, 'migration applied');
    } catch (err) {
      conn.exec('ROLLBACK');
      throw err;
    }
  }
}
