import { z } from 'zod';
import { SPLIT_TYPES } from '../domain/splits.js';

export const idParam = z.object({ id: z.string().uuid() });
export const groupIdParam = z.object({ groupId: z.string().uuid() });
export const memberParams = z.object({ groupId: z.string().uuid(), userId: z.string().uuid() });

const name = z.string().trim().min(1, 'Name is required').max(80);
const email = z.string().trim().email().max(254);
const money = z.number().positive('Amount must be greater than zero').max(1_000_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const currency = z.string().trim().length(3).toUpperCase();

export const createUserBody = z.object({ name, email: email.optional().or(z.literal('')).transform((v) => v || undefined) });
export const updateUserBody = z
  .object({ name: name.optional(), email: email.nullable().optional().or(z.literal('')) })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const createGroupBody = z.object({
  name,
  description: z.string().trim().max(280).optional(),
  currency: currency.optional(),
  memberIds: z.array(z.string().uuid()).max(100).default([]),
});
export const updateGroupBody = z
  .object({ name: name.optional(), description: z.string().trim().max(280).nullable().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');
export const addMemberBody = z.object({ userId: z.string().uuid() });

const participant = z.object({ userId: z.string().uuid(), value: z.number().nonnegative().optional() });
const expenseCore = {
  description: z.string().trim().min(1).max(140),
  amount: money,
  paidBy: z.string().uuid(),
  category: z.string().trim().min(1).max(40).optional(),
  splitType: z.enum(SPLIT_TYPES),
  participants: z.array(participant).min(1).max(100),
  expenseDate: isoDate.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
};
export const createExpenseBody = z.object(expenseCore);
export const updateExpenseBody = z
  .object(Object.fromEntries(Object.entries(expenseCore).map(([k, v]) => [k, v.optional()])))
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const createSettlementBody = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: money,
  note: z.string().trim().max(140).nullable().optional(),
  settledAt: isoDate.optional(),
});

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const activityQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
export const listGroupsQuery = z.object({ userId: z.string().uuid().optional() });
export const seedQuery = z.object({
  force: z
    .string()
    .optional()
    .transform((v) => ['1', 'true', 'yes'].includes((v ?? '').toLowerCase())),
});
