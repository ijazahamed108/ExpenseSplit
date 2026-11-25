import { getDb, transaction } from '../db/connection.js';
import { conflict } from '../errors.js';
import { createExpense } from './expenses.service.js';
import { createGroup } from './groups.service.js';
import { createSettlement } from './settlements.service.js';
import { createUser } from './users.service.js';

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/**
 * Load a realistic demo dataset. Refuses to run on a non-empty database unless `force`
 * is set, in which case all data is wiped first.
 */
export function seedDemoData({ force = false } = {}) {
  const db = getDb();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0 && !force) throw conflict('Database is not empty. Pass force=true to wipe and reseed.');

  return transaction(() => {
    if (force) {
      db.exec('DELETE FROM settlements; DELETE FROM expense_splits; DELETE FROM expenses; DELETE FROM group_members; DELETE FROM groups; DELETE FROM users;');
    }

    const [aisha, ben, chloe, dev, emma] = [
      ['Aisha Khan', 'aisha@example.com'],
      ['Ben Carter', 'ben@example.com'],
      ['Chloe Martin', 'chloe@example.com'],
      ['Dev Patel', 'dev@example.com'],
      ['Emma Rossi', 'emma@example.com'],
    ].map(([name, email]) => createUser({ name, email }));

    const trip = createGroup({
      name: 'Lisbon Trip',
      description: 'Long weekend in Lisbon',
      currency: 'EUR',
      memberIds: [aisha.id, ben.id, chloe.id, dev.id],
    });
    const flat = createGroup({
      name: 'Flat 4B',
      description: 'Monthly shared household costs',
      currency: 'USD',
      memberIds: [aisha.id, emma.id, dev.id],
    });

    const tripAll = [aisha, ben, chloe, dev].map((u) => ({ userId: u.id }));
    createExpense(trip.id, { description: 'Airbnb (3 nights)', amount: 612, paidBy: aisha.id, category: 'accommodation', splitType: 'equal', participants: tripAll, expenseDate: daysAgo(12) });
    createExpense(trip.id, { description: 'Dinner at Cervejaria Ramiro', amount: 158.4, paidBy: ben.id, category: 'food', splitType: 'equal', participants: tripAll, expenseDate: daysAgo(11) });
    createExpense(trip.id, { description: 'Tram 28 & museum tickets', amount: 74, paidBy: chloe.id, category: 'entertainment', splitType: 'shares', participants: [{ userId: aisha.id, value: 1 }, { userId: ben.id, value: 1 }, { userId: chloe.id, value: 2 }, { userId: dev.id, value: 1 }], expenseDate: daysAgo(10), notes: 'Chloe bought two museum passes' });
    createExpense(trip.id, { description: 'Groceries & wine', amount: 63.25, paidBy: dev.id, category: 'groceries', splitType: 'percent', participants: [{ userId: aisha.id, value: 25 }, { userId: ben.id, value: 25 }, { userId: chloe.id, value: 25 }, { userId: dev.id, value: 25 }], expenseDate: daysAgo(10) });
    createExpense(trip.id, { description: 'Taxi to airport', amount: 38, paidBy: ben.id, category: 'transport', splitType: 'exact', participants: [{ userId: ben.id, value: 19 }, { userId: dev.id, value: 19 }], expenseDate: daysAgo(9) });
    createSettlement(trip.id, { fromUserId: chloe.id, toUserId: aisha.id, amount: 100, note: 'Partial Airbnb payback', settledAt: daysAgo(7) });

    const flatAll = [aisha, emma, dev].map((u) => ({ userId: u.id }));
    createExpense(flat.id, { description: 'Rent – November', amount: 2400, paidBy: emma.id, category: 'rent', splitType: 'equal', participants: flatAll, expenseDate: daysAgo(25) });
    createExpense(flat.id, { description: 'Electricity bill', amount: 142.3, paidBy: aisha.id, category: 'utilities', splitType: 'equal', participants: flatAll, expenseDate: daysAgo(14) });
    createExpense(flat.id, { description: 'Internet', amount: 60, paidBy: dev.id, category: 'utilities', splitType: 'equal', participants: flatAll, expenseDate: daysAgo(14) });
    createExpense(flat.id, { description: 'Costco run', amount: 187.55, paidBy: emma.id, category: 'groceries', splitType: 'shares', participants: [{ userId: aisha.id, value: 2 }, { userId: emma.id, value: 1 }, { userId: dev.id, value: 1 }], expenseDate: daysAgo(5), notes: 'Aisha had guests over' });
    createSettlement(flat.id, { fromUserId: aisha.id, toUserId: emma.id, amount: 800, note: 'Rent share', settledAt: daysAgo(20) });
    createSettlement(flat.id, { fromUserId: dev.id, toUserId: emma.id, amount: 800, note: 'Rent share', settledAt: daysAgo(19) });

    return {
      users: [aisha, ben, chloe, dev, emma].map((u) => ({ id: u.id, name: u.name })),
      groups: [trip, flat].map((g) => ({ id: g.id, name: g.name })),
    };
  });
}
