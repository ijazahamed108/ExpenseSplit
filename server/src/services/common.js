import { randomUUID } from 'node:crypto';
import { fromCents } from '../domain/money.js';

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

export const mapUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

export const mapGroup = (row) =>
  row && {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

export const mapExpense = (row, splits = []) =>
  row && {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: fromCents(row.amount_cents),
    currency: row.currency,
    paidBy: row.paid_by,
    category: row.category,
    splitType: row.split_type,
    expenseDate: row.expense_date,
    notes: row.notes ?? null,
    splits: splits.map((s) => ({
      userId: s.user_id,
      amount: fromCents(s.amount_cents),
      shareValue: s.share_value ?? null,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

export const mapSettlement = (row) =>
  row && {
    id: row.id,
    groupId: row.group_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amount: fromCents(row.amount_cents),
    currency: row.currency,
    note: row.note ?? null,
    settledAt: row.settled_at,
    createdAt: row.created_at,
  };
