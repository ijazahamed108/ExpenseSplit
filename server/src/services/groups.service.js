import { config } from '../config.js';
import { getDb, transaction } from '../db/connection.js';
import { fromCents } from '../domain/money.js';
import { conflict, notFound, unprocessable } from '../errors.js';
import { computeNetBalances } from './balances.service.js';
import { mapGroup, mapUser, newId, nowIso } from './common.js';

function membersOf(groupId) {
  return getDb()
    .prepare(
      `SELECT u.*, gm.joined_at FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ? ORDER BY gm.joined_at, u.name COLLATE NOCASE`,
    )
    .all(groupId)
    .map((r) => ({ ...mapUser(r), joinedAt: r.joined_at }));
}

function statsOf(groupId) {
  const s = getDb()
    .prepare(
      `SELECT COUNT(*) AS expense_count, COALESCE(SUM(amount_cents), 0) AS total_cents
       FROM expenses WHERE group_id = ? AND deleted_at IS NULL`,
    )
    .get(groupId);
  return { expenseCount: s.expense_count, totalSpent: fromCents(s.total_cents) };
}

export function getGroupRow(id) {
  const row = getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id);
  if (!row) throw notFound('Group');
  return row;
}

export function getGroup(id) {
  const row = getGroupRow(id);
  return { ...mapGroup(row), members: membersOf(id), stats: statsOf(id) };
}

export function listGroups({ userId } = {}) {
  const db = getDb();
  const rows = userId
    ? db
        .prepare(
          `SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id
           WHERE gm.user_id = ? ORDER BY g.created_at DESC`,
        )
        .all(userId)
    : db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();
  return rows.map((row) => ({ ...mapGroup(row), members: membersOf(row.id), stats: statsOf(row.id) }));
}

export function createGroup({ name, description, currency, memberIds = [] }) {
  const db = getDb();
  const id = newId();
  const ts = nowIso();
  const uniqueMembers = [...new Set(memberIds)];

  transaction(() => {
    db.prepare(
      'INSERT INTO groups (id, name, description, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, name.trim(), description?.trim() || null, (currency || config.defaultCurrency).toUpperCase(), ts, ts);
    const insert = db.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)');
    for (const userId of uniqueMembers) {
      if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw notFound(`User ${userId}`);
      insert.run(id, userId, ts);
    }
  });
  return getGroup(id);
}

export function updateGroup(id, patch) {
  const db = getDb();
  const existing = getGroupRow(id);
  db.prepare('UPDATE groups SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(
    patch.name !== undefined ? patch.name.trim() : existing.name,
    patch.description !== undefined ? patch.description?.trim() || null : existing.description,
    nowIso(),
    id,
  );
  return getGroup(id);
}

export function deleteGroup(id) {
  getGroupRow(id);
  // ON DELETE CASCADE removes members, expenses, splits and settlements.
  getDb().prepare('DELETE FROM groups WHERE id = ?').run(id);
}

export function assertMember(groupId, userId, label = 'User') {
  const row = getDb().prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
  if (!row) throw unprocessable(`${label} ${userId} is not a member of this group`);
}

export function addMember(groupId, userId) {
  const db = getDb();
  getGroupRow(groupId);
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw notFound('User');
  if (db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId)) {
    throw conflict('User is already a member of this group');
  }
  db.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').run(groupId, userId, nowIso());
  return getGroup(groupId);
}

export function removeMember(groupId, userId) {
  const db = getDb();
  getGroupRow(groupId);
  assertMember(groupId, userId);
  const net = computeNetBalances(groupId)[userId] ?? 0;
  if (net !== 0) {
    throw conflict('Member has an outstanding balance in this group. Settle up before removing them.', {
      net: fromCents(net),
    });
  }
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
  return getGroup(groupId);
}
