import { getDb } from '../db/connection.js';
import { fromCents } from '../domain/money.js';
import { getGroupRow } from './groups.service.js';

/** Unified, newest-first feed of expenses and settlements (including deleted ones, flagged). */
export function listActivity(groupId, { limit = 50 } = {}) {
  getGroupRow(groupId);
  const rows = getDb()
    .prepare(
      `SELECT * FROM (
         SELECT 'expense' AS type, e.id, e.description AS title, e.amount_cents, e.currency,
                e.paid_by AS actor_id, NULL AS counterparty_id, e.category, e.expense_date AS happened_at,
                e.created_at, e.deleted_at
         FROM expenses e WHERE e.group_id = ?
         UNION ALL
         SELECT 'settlement' AS type, s.id, COALESCE(s.note, 'Settlement') AS title, s.amount_cents, s.currency,
                s.from_user_id AS actor_id, s.to_user_id AS counterparty_id, 'settlement' AS category,
                s.settled_at AS happened_at, s.created_at, s.deleted_at
         FROM settlements s WHERE s.group_id = ?
       ) ORDER BY created_at DESC LIMIT ?`,
    )
    .all(groupId, groupId, limit);

  return rows.map((r) => ({
    type: r.type,
    id: r.id,
    title: r.title,
    amount: fromCents(r.amount_cents),
    currency: r.currency,
    actorId: r.actor_id,
    counterpartyId: r.counterparty_id,
    category: r.category,
    happenedAt: r.happened_at,
    createdAt: r.created_at,
    deleted: Boolean(r.deleted_at),
  }));
}
