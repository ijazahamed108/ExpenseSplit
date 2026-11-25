import { getDb, transaction } from '../db/connection.js';
import { toCents } from '../domain/money.js';
import { computeSplits } from '../domain/splits.js';
import { notFound } from '../errors.js';
import { mapExpense, newId, nowIso } from './common.js';
import { assertMember, getGroupRow } from './groups.service.js';

const splitsFor = (expenseId) =>
  getDb().prepare('SELECT * FROM expense_splits WHERE expense_id = ? ORDER BY rowid').all(expenseId);

export function getExpense(id) {
  const row = getDb().prepare('SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!row) throw notFound('Expense');
  return mapExpense(row, splitsFor(id));
}

export function listExpenses(groupId, { limit = 50, offset = 0 } = {}) {
  const db = getDb();
  getGroupRow(groupId);
  const { n: total } = db
    .prepare('SELECT COUNT(*) AS n FROM expenses WHERE group_id = ? AND deleted_at IS NULL')
    .get(groupId);
  const rows = db
    .prepare(
      `SELECT * FROM expenses WHERE group_id = ? AND deleted_at IS NULL
       ORDER BY expense_date DESC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(groupId, limit, offset);
  return { items: rows.map((r) => mapExpense(r, splitsFor(r.id))), total, limit, offset };
}

/**
 * Payer and participants must be current members. When editing, people who were already on
 * the expense stay valid even if they have since left the group (their history is preserved).
 */
function validateParticipants(groupId, paidBy, participants, grandfathered = new Set()) {
  if (!grandfathered.has(paidBy)) assertMember(groupId, paidBy, 'Payer');
  for (const p of participants) {
    if (!grandfathered.has(p.userId)) assertMember(groupId, p.userId, 'Participant');
  }
}

export function createExpense(groupId, input) {
  const db = getDb();
  const group = getGroupRow(groupId);
  validateParticipants(groupId, input.paidBy, input.participants);

  const amountCents = toCents(input.amount);
  const splits = computeSplits(input.splitType, amountCents, input.participants);
  const id = newId();
  const ts = nowIso();

  transaction(() => {
    db.prepare(
      `INSERT INTO expenses (id, group_id, description, amount_cents, currency, paid_by, category, split_type,
         expense_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      groupId,
      input.description.trim(),
      amountCents,
      group.currency,
      input.paidBy,
      input.category ?? 'general',
      input.splitType,
      input.expenseDate ?? ts.slice(0, 10),
      input.notes?.trim() || null,
      ts,
      ts,
    );
    insertSplits(id, splits);
  });
  return getExpense(id);
}

function insertSplits(expenseId, splits) {
  const stmt = getDb().prepare(
    'INSERT INTO expense_splits (expense_id, user_id, amount_cents, share_value) VALUES (?, ?, ?, ?)',
  );
  for (const s of splits) stmt.run(expenseId, s.userId, s.amountCents, s.shareValue);
}

export function updateExpense(id, patch) {
  const db = getDb();
  const existing = getExpense(id);
  const merged = {
    description: patch.description ?? existing.description,
    amount: patch.amount ?? existing.amount,
    paidBy: patch.paidBy ?? existing.paidBy,
    category: patch.category ?? existing.category,
    splitType: patch.splitType ?? existing.splitType,
    expenseDate: patch.expenseDate ?? existing.expenseDate,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    participants:
      patch.participants ??
      existing.splits.map((s) => ({
        userId: s.userId,
        value: existing.splitType === 'exact' ? s.amount : s.shareValue ?? undefined,
      })),
  };

  // If amount/type changed but participants weren't resent, an "exact" split can no longer be
  // valid; fall back to an equal split among the same people so the edit still succeeds sensibly.
  if (!patch.participants && merged.splitType === 'exact' && merged.amount !== existing.amount) {
    merged.splitType = 'equal';
  }

  const grandfathered = new Set([existing.paidBy, ...existing.splits.map((s) => s.userId)]);
  validateParticipants(existing.groupId, merged.paidBy, merged.participants, grandfathered);
  const amountCents = toCents(merged.amount);
  const splits = computeSplits(merged.splitType, amountCents, merged.participants);

  transaction(() => {
    db.prepare(
      `UPDATE expenses SET description = ?, amount_cents = ?, paid_by = ?, category = ?, split_type = ?,
         expense_date = ?, notes = ?, updated_at = ? WHERE id = ?`,
    ).run(
      merged.description.trim(),
      amountCents,
      merged.paidBy,
      merged.category,
      merged.splitType,
      merged.expenseDate,
      merged.notes?.trim() || null,
      nowIso(),
      id,
    );
    db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(id);
    insertSplits(id, splits);
  });
  return getExpense(id);
}

export function deleteExpense(id) {
  getExpense(id);
  getDb().prepare('UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), id);
}
