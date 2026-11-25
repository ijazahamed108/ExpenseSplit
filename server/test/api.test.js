import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.API_KEY = '';

const { initDb, closeDb } = await import('../src/db/connection.js');
const { createApp } = await import('../src/app.js');

let api;
beforeAll(() => {
  initDb(':memory:');
  api = request(createApp());
});
afterAll(() => closeDb());

const user = async (name) => (await api.post('/api/v1/users').send({ name }).expect(201)).body;

describe('health & docs', () => {
  it('reports healthy', async () => {
    const res = await api.get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
  it('serves the OpenAPI document', async () => {
    const res = await api.get('/api/openapi.json').expect(200);
    expect(res.body.openapi).toBe('3.0.3');
  });
  it('404s unknown API routes as JSON', async () => {
    const res = await api.get('/api/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('users', () => {
  it('validates input', async () => {
    const res = await api.post('/api/v1/users').send({ name: '' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('creates, lists, updates and rejects duplicate emails', async () => {
    const u = (await api.post('/api/v1/users').send({ name: 'Zed', email: 'Zed@Example.com' }).expect(201)).body;
    expect(u.email).toBe('zed@example.com');
    await api.post('/api/v1/users').send({ name: 'Other', email: 'zed@example.com' }).expect(409);
    const patched = (await api.patch(`/api/v1/users/${u.id}`).send({ name: 'Zed Z' }).expect(200)).body;
    expect(patched.name).toBe('Zed Z');
    const list = (await api.get('/api/v1/users').expect(200)).body;
    expect(list.some((x) => x.id === u.id)).toBe(true);
    await api.delete(`/api/v1/users/${u.id}`).expect(204);
    await api.get(`/api/v1/users/${u.id}`).expect(404);
  });
});

describe('end-to-end group flow', () => {
  let alice, bob, carol, group;

  beforeAll(async () => {
    [alice, bob, carol] = await Promise.all([user('Alice'), user('Bob'), user('Carol')]);
    group = (
      await api.post('/api/v1/groups').send({ name: 'Trip', currency: 'eur', memberIds: [alice.id, bob.id] }).expect(201)
    ).body;
    expect(group.currency).toBe('EUR');
    expect(group.members).toHaveLength(2);
  });

  it('adds members and rejects duplicates', async () => {
    const g = (await api.post(`/api/v1/groups/${group.id}/members`).send({ userId: carol.id }).expect(201)).body;
    expect(g.members).toHaveLength(3);
    await api.post(`/api/v1/groups/${group.id}/members`).send({ userId: carol.id }).expect(409);
  });

  it('rejects expenses paid by or including non-members', async () => {
    const stranger = await user('Stranger');
    const res = await api
      .post(`/api/v1/groups/${group.id}/expenses`)
      .send({ description: 'x', amount: 10, paidBy: stranger.id, splitType: 'equal', participants: [{ userId: alice.id }] })
      .expect(422);
    expect(res.body.error.message).toMatch(/not a member/);
  });

  it('creates an equal expense whose splits sum exactly', async () => {
    const res = await api
      .post(`/api/v1/groups/${group.id}/expenses`)
      .send({
        description: 'Dinner',
        amount: 100,
        paidBy: alice.id,
        category: 'food',
        splitType: 'equal',
        participants: [{ userId: alice.id }, { userId: bob.id }, { userId: carol.id }],
      })
      .expect(201);
    const sum = res.body.splits.reduce((a, s) => a + s.amount, 0);
    expect(Math.round(sum * 100)).toBe(10000);
    expect(res.body.splits.map((s) => s.amount)).toEqual([33.34, 33.33, 33.33]);
  });

  it('computes net, pairwise and simplified balances', async () => {
    // Bob pays 30 split exactly: Bob 10, Carol 20
    await api
      .post(`/api/v1/groups/${group.id}/expenses`)
      .send({
        description: 'Taxi',
        amount: 30,
        paidBy: bob.id,
        splitType: 'exact',
        participants: [{ userId: bob.id, value: 10 }, { userId: carol.id, value: 20 }],
      })
      .expect(201);

    const b = (await api.get(`/api/v1/groups/${group.id}/balances`).expect(200)).body;
    const net = Object.fromEntries(b.members.map((m) => [m.user.id, m.net]));
    // Alice: paid 100, share 33.34  -> +66.66
    // Bob:   paid 30,  share 33.33 + 10 -> -13.33
    // Carol: paid 0,   share 33.33 + 20 -> -53.33
    expect(net[alice.id]).toBeCloseTo(66.66, 2);
    expect(net[bob.id]).toBeCloseTo(-13.33, 2);
    expect(net[carol.id]).toBeCloseTo(-53.33, 2);
    expect(b.totalSpent).toBe(130);

    const pair = (f, t) => b.pairwise.find((p) => p.from === f && p.to === t)?.amount;
    expect(pair(bob.id, alice.id)).toBeCloseTo(33.33, 2);
    expect(pair(carol.id, alice.id)).toBeCloseTo(33.33, 2);
    expect(pair(carol.id, bob.id)).toBeCloseTo(20, 2);

    expect(b.suggestedSettlements.length).toBeLessThanOrEqual(2);
    const check = { ...net };
    for (const t of b.suggestedSettlements) {
      check[t.from] = +(check[t.from] + t.amount).toFixed(2);
      check[t.to] = +(check[t.to] - t.amount).toFixed(2);
    }
    expect(Object.values(check).every((v) => Math.abs(v) < 0.005)).toBe(true);
  });

  it('records settlements and reflects them in balances and activity', async () => {
    await api
      .post(`/api/v1/groups/${group.id}/settlements`)
      .send({ fromUserId: carol.id, toUserId: alice.id, amount: 53.33, note: 'cash' })
      .expect(201);
    const b = (await api.get(`/api/v1/groups/${group.id}/balances`).expect(200)).body;
    const carolNet = b.members.find((m) => m.user.id === carol.id).net;
    expect(carolNet).toBeCloseTo(0, 2);

    const activity = (await api.get(`/api/v1/groups/${group.id}/activity`).expect(200)).body;
    expect(activity[0].type).toBe('settlement');
    expect(activity).toHaveLength(3);

    await api
      .post(`/api/v1/groups/${group.id}/settlements`)
      .send({ fromUserId: carol.id, toUserId: carol.id, amount: 1 })
      .expect(422);
  });

  it('blocks removing a member with a balance, allows once settled', async () => {
    await api.delete(`/api/v1/groups/${group.id}/members/${bob.id}`).expect(409);
    const g = (await api.delete(`/api/v1/groups/${group.id}/members/${carol.id}`).expect(200)).body;
    expect(g.members.map((m) => m.id)).not.toContain(carol.id);
  });

  it('edits and soft-deletes expenses', async () => {
    const list = (await api.get(`/api/v1/groups/${group.id}/expenses`).expect(200)).body;
    expect(list.total).toBe(2);
    const taxi = list.items.find((e) => e.description === 'Taxi');
    const edited = (await api.patch(`/api/v1/expenses/${taxi.id}`).send({ amount: 40, description: 'Taxi (fixed)' }).expect(200)).body;
    expect(edited.amount).toBe(40);
    expect(edited.splits.reduce((a, s) => a + s.amount, 0)).toBe(40);

    await api.delete(`/api/v1/expenses/${taxi.id}`).expect(204);
    await api.get(`/api/v1/expenses/${taxi.id}`).expect(404);
    const after = (await api.get(`/api/v1/groups/${group.id}/expenses`).expect(200)).body;
    expect(after.total).toBe(1);
    const activity = (await api.get(`/api/v1/groups/${group.id}/activity`).expect(200)).body;
    expect(activity.find((a) => a.id === taxi.id).deleted).toBe(true);
  });

  it('summarises a user across groups', async () => {
    const res = await api.get(`/api/v1/users/${alice.id}/balances`).expect(200);
    expect(res.body.groups).toHaveLength(1);
    expect(res.body.totals.EUR.owed).toBeGreaterThan(0);
  });

  it('deletes a group and cascades', async () => {
    await api.delete(`/api/v1/groups/${group.id}`).expect(204);
    await api.get(`/api/v1/groups/${group.id}`).expect(404);
  });
});

describe('demo seed', () => {
  it('seeds and refuses to overwrite without force', async () => {
    const res = await api.post('/api/v1/demo/seed?force=true').expect(201);
    expect(res.body.groups).toHaveLength(2);
    await api.post('/api/v1/demo/seed').expect(409);
    const groups = (await api.get('/api/v1/groups').expect(200)).body;
    const trip = groups.find((g) => g.name === 'Lisbon Trip');
    const balances = (await api.get(`/api/v1/groups/${trip.id}/balances`).expect(200)).body;
    const total = balances.members.reduce((a, m) => a + m.net, 0);
    expect(Math.abs(total)).toBeLessThan(0.005);
  });
});
