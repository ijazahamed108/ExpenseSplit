import { getDb } from '../db/connection.js';
import { fromCents } from '../domain/money.js';
import { simplifyDebts } from '../domain/settle.js';
import { notFound } from '../errors.js';
import { mapGroup, mapUser } from './common.js';

/**
 * Net position per member in a group, in cents.
 *   net = paid − own share + settlements paid out − settlements received
 * Positive means the member is owed money; negative means they owe.
 * Balances are derived from the ledger on every call (never stored), so they can't drift.
 */
export function computeNetBalances(groupId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT gm.user_id AS user_id,
        COALESCE((SELECT SUM(e.amount_cents) FROM expenses e
                  WHERE e.group_id = gm.group_id AND e.paid_by = gm.user_id AND e.deleted_at IS NULL), 0) AS paid,
        COALESCE((SELECT SUM(s.amount_cents) FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
                  WHERE e.group_id = gm.group_id AND s.user_id = gm.user_id AND e.deleted_at IS NULL), 0) AS share,
        COALESCE((SELECT SUM(st.amount_cents) FROM settlements st
                  WHERE st.group_id = gm.group_id AND st.from_user_id = gm.user_id AND st.deleted_at IS NULL), 0) AS settled_out,
        COALESCE((SELECT SUM(st.amount_cents) FROM settlements st
                  WHERE st.group_id = gm.group_id AND st.to_user_id = gm.user_id AND st.deleted_at IS NULL), 0) AS settled_in
       FROM group_members gm WHERE gm.group_id = ?`,
    )
    .all(groupId);

  const net = {};
  for (const r of rows) net[r.user_id] = r.paid - r.share + r.settled_out - r.settled_in;
  return net;
}

/** Pairwise "who owes whom" after netting both directions, in cents. */
function computePairwise(groupId) {
  const db = getDb();
  const debt = new Map(); // key "a->b" = cents a owes b
  const add = (from, to, cents) => {
    if (from === to || cents === 0) return;
    const key = `${from}->${to}`;
    debt.set(key, (debt.get(key) ?? 0) + cents);
  };

  const splitRows = db
    .prepare(
      `SELECT s.user_id AS debtor, e.paid_by AS creditor, SUM(s.amount_cents) AS cents
       FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
       WHERE e.group_id = ? AND e.deleted_at IS NULL AND s.user_id <> e.paid_by
       GROUP BY s.user_id, e.paid_by`,
    )
    .all(groupId);
  for (const r of splitRows) add(r.debtor, r.creditor, r.cents);

  const settlementRows = db
    .prepare(
      `SELECT from_user_id, to_user_id, SUM(amount_cents) AS cents FROM settlements
       WHERE group_id = ? AND deleted_at IS NULL GROUP BY from_user_id, to_user_id`,
    )
    .all(groupId);
  // Paying someone reduces what you owe them (equivalently: they now owe you that much).
  for (const r of settlementRows) add(r.to_user_id, r.from_user_id, r.cents);

  const seen = new Set();
  const result = [];
  for (const key of debt.keys()) {
    const [a, b] = key.split('->');
    const pairKey = [a, b].sort().join('|');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const ab = debt.get(`${a}->${b}`) ?? 0;
    const ba = debt.get(`${b}->${a}`) ?? 0;
    const netCents = ab - ba;
    if (netCents > 0) result.push({ from: a, to: b, amountCents: netCents });
    else if (netCents < 0) result.push({ from: b, to: a, amountCents: -netCents });
  }
  return result.sort((x, y) => y.amountCents - x.amountCents);
}

export function getGroupBalances(groupId) {
  const db = getDb();
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) throw notFound('Group');

  const detail = db
    .prepare(
      `SELECT u.*, 
        COALESCE((SELECT SUM(e.amount_cents) FROM expenses e WHERE e.group_id = gm.group_id AND e.paid_by = u.id AND e.deleted_at IS NULL), 0) AS paid,
        COALESCE((SELECT SUM(s.amount_cents) FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
                  WHERE e.group_id = gm.group_id AND s.user_id = u.id AND e.deleted_at IS NULL), 0) AS share
       FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? ORDER BY u.name COLLATE NOCASE`,
    )
    .all(groupId);

  const net = computeNetBalances(groupId);
  const pairwise = computePairwise(groupId);
  const suggested = simplifyDebts(net);
  const toMoney = (t) => ({ from: t.from, to: t.to, amount: fromCents(t.amountCents) });

  return {
    group: mapGroup(group),
    currency: group.currency,
    members: detail.map((r) => ({
      user: mapUser(r),
      paid: fromCents(r.paid),
      share: fromCents(r.share),
      net: fromCents(net[r.id] ?? 0),
    })),
    pairwise: pairwise.map(toMoney),
    suggestedSettlements: suggested.map(toMoney),
    totalSpent: fromCents(detail.reduce((a, r) => a + r.paid, 0)),
  };
}

/** Cross-group summary for one user: net per group plus totals owed/owing. */
export function getUserBalances(userId) {
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw notFound('User');

  const groups = db
    .prepare(
      `SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? ORDER BY g.name COLLATE NOCASE`,
    )
    .all(userId);

  const perGroup = groups.map((g) => {
    const net = computeNetBalances(g.id)[userId] ?? 0;
    return { group: mapGroup(g), currency: g.currency, net: fromCents(net), netCents: net };
  });

  const byCurrency = {};
  for (const g of perGroup) {
    const bucket = (byCurrency[g.currency] ??= { owed: 0, owing: 0 });
    if (g.netCents > 0) bucket.owed += g.netCents;
    else bucket.owing += -g.netCents;
  }

  return {
    userId,
    groups: perGroup.map(({ netCents: _omit, ...rest }) => rest),
    totals: Object.fromEntries(
      Object.entries(byCurrency).map(([cur, v]) => [
        cur,
        { owed: fromCents(v.owed), owing: fromCents(v.owing), net: fromCents(v.owed - v.owing) },
      ]),
    ),
  };
}
