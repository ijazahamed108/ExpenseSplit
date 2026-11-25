import { Router } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { validate } from '../middleware/index.js';
import { listActivity } from '../services/activity.service.js';
import { getGroupBalances, getUserBalances } from '../services/balances.service.js';
import * as expenses from '../services/expenses.service.js';
import * as groups from '../services/groups.service.js';
import { seedDemoData } from '../services/seed.service.js';
import * as settlements from '../services/settlements.service.js';
import * as users from '../services/users.service.js';
import * as s from './schemas.js';

export const apiV1 = Router();

// ---- Users -------------------------------------------------------------
apiV1.get('/users', (_req, res) => res.json(users.listUsers()));
apiV1.post('/users', validate({ body: s.createUserBody }), (req, res) => res.status(201).json(users.createUser(req.body)));
apiV1.get('/users/:id', validate({ params: s.idParam }), (req, res) => res.json(users.getUser(req.params.id)));
apiV1.patch('/users/:id', validate({ params: s.idParam, body: s.updateUserBody }), (req, res) =>
  res.json(users.updateUser(req.params.id, req.body)),
);
apiV1.delete('/users/:id', validate({ params: s.idParam }), (req, res) => {
  users.deleteUser(req.params.id);
  res.status(204).end();
});
apiV1.get('/users/:id/balances', validate({ params: s.idParam }), (req, res) => res.json(getUserBalances(req.params.id)));

// ---- Groups & members --------------------------------------------------
apiV1.get('/groups', validate({ query: s.listGroupsQuery }), (req, res) => res.json(groups.listGroups(req.query)));
apiV1.post('/groups', validate({ body: s.createGroupBody }), (req, res) => res.status(201).json(groups.createGroup(req.body)));
apiV1.get('/groups/:id', validate({ params: s.idParam }), (req, res) => res.json(groups.getGroup(req.params.id)));
apiV1.patch('/groups/:id', validate({ params: s.idParam, body: s.updateGroupBody }), (req, res) =>
  res.json(groups.updateGroup(req.params.id, req.body)),
);
apiV1.delete('/groups/:id', validate({ params: s.idParam }), (req, res) => {
  groups.deleteGroup(req.params.id);
  res.status(204).end();
});
apiV1.post('/groups/:groupId/members', validate({ params: s.groupIdParam, body: s.addMemberBody }), (req, res) =>
  res.status(201).json(groups.addMember(req.params.groupId, req.body.userId)),
);
apiV1.delete('/groups/:groupId/members/:userId', validate({ params: s.memberParams }), (req, res) =>
  res.json(groups.removeMember(req.params.groupId, req.params.userId)),
);

// ---- Expenses ----------------------------------------------------------
apiV1.get('/groups/:groupId/expenses', validate({ params: s.groupIdParam, query: s.paginationQuery }), (req, res) =>
  res.json(expenses.listExpenses(req.params.groupId, req.query)),
);
apiV1.post('/groups/:groupId/expenses', validate({ params: s.groupIdParam, body: s.createExpenseBody }), (req, res) =>
  res.status(201).json(expenses.createExpense(req.params.groupId, req.body)),
);
apiV1.get('/expenses/:id', validate({ params: s.idParam }), (req, res) => res.json(expenses.getExpense(req.params.id)));
apiV1.patch('/expenses/:id', validate({ params: s.idParam, body: s.updateExpenseBody }), (req, res) =>
  res.json(expenses.updateExpense(req.params.id, req.body)),
);
apiV1.delete('/expenses/:id', validate({ params: s.idParam }), (req, res) => {
  expenses.deleteExpense(req.params.id);
  res.status(204).end();
});

// ---- Settlements -------------------------------------------------------
apiV1.get('/groups/:groupId/settlements', validate({ params: s.groupIdParam }), (req, res) =>
  res.json(settlements.listSettlements(req.params.groupId)),
);
apiV1.post('/groups/:groupId/settlements', validate({ params: s.groupIdParam, body: s.createSettlementBody }), (req, res) =>
  res.status(201).json(settlements.createSettlement(req.params.groupId, req.body)),
);
apiV1.delete('/settlements/:id', validate({ params: s.idParam }), (req, res) => {
  settlements.deleteSettlement(req.params.id);
  res.status(204).end();
});

// ---- Balances & activity ----------------------------------------------
apiV1.get('/groups/:groupId/balances', validate({ params: s.groupIdParam }), (req, res) =>
  res.json(getGroupBalances(req.params.groupId)),
);
apiV1.get('/groups/:groupId/activity', validate({ params: s.groupIdParam, query: s.activityQuery }), (req, res) =>
  res.json(listActivity(req.params.groupId, req.query)),
);

// ---- Demo --------------------------------------------------------------
apiV1.post('/demo/seed', validate({ query: s.seedQuery }), (req, res) => {
  if (!config.enableDemoSeed) throw new AppError(403, 'FORBIDDEN', 'Demo seeding is disabled (ENABLE_DEMO_SEED=false)');
  res.status(201).json(seedDemoData({ force: req.query.force }));
});
