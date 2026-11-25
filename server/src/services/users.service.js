import { getDb } from '../db/connection.js';
import { conflict, notFound } from '../errors.js';
import { mapUser, newId, nowIso } from './common.js';

export function listUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE').all().map(mapUser);
}

export function getUser(id) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) throw notFound('User');
  return mapUser(row);
}

export function createUser({ name, email }) {
  const db = getDb();
  const normalizedEmail = email ? email.toLowerCase() : null;
  if (normalizedEmail && db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalizedEmail)) {
    throw conflict('A user with this email already exists');
  }
  const ts = nowIso();
  const id = newId();
  db.prepare('INSERT INTO users (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name.trim(),
    normalizedEmail,
    ts,
    ts,
  );
  return getUser(id);
}

export function updateUser(id, patch) {
  const db = getDb();
  const existing = getUser(id);
  const name = patch.name !== undefined ? patch.name.trim() : existing.name;
  const email = patch.email !== undefined ? (patch.email ? patch.email.toLowerCase() : null) : existing.email;
  if (email && email !== existing.email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw conflict('A user with this email already exists');
  }
  db.prepare('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?').run(name, email, nowIso(), id);
  return getUser(id);
}

export function deleteUser(id) {
  const db = getDb();
  getUser(id);
  const membership = db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?').get(id);
  if (membership.n > 0) {
    throw conflict('User belongs to one or more groups. Remove them from all groups first.');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
