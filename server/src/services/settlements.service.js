import { getDb } from '../db/connection.js';
import { toCents } from '../domain/money.js';
import { notFound, unprocessable } from '../errors.js';
import { mapSettlement, newId, nowIso } from './common.js';
import { assertMember, getGroupRow } from './groups.service.js';

export function listSettlements(groupId) {
  getGroupRow(groupId);
  return getDb()
    .prepare(
      `SELECT * FROM settlements WHERE group_id = ? AND deleted_at IS NULL
       ORDER BY settled_at DESC, created_at DESC`,
    )
    .all(groupId)
    .map(mapSettlement);
}

export function getSettlement(id) {
  const row = getDb().prepare('SELECT * FROM settlements WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) throw notFound('Settlement');
  return mapSettlement(row);
}

export function createSettlement(groupId, { fromUserId, toUserId, amount, note, settledAt }) {
  const group = getGroupRow(groupId);
  if (fromUserId === toUserId) throw unprocessable('Payer and recipient must be different people');
  assertMember(groupId, fromUserId, 'Payer');
  assertMember(groupId, toUserId, 'Recipient');

  const id = newId();
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO settlements (id, group_id, from_user_id, to_user_id, amount_cents, currency, note, settled_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, groupId, fromUserId, toUserId, toCents(amount), group.currency, note?.trim() || null, settledAt ?? ts.slice(0, 10), ts);
  return getSettlement(id);
}

export function deleteSettlement(id) {
  getSettlement(id);
  getDb().prepare('UPDATE settlements SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
}
