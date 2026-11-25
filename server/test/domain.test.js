import { describe, expect, it } from 'vitest';
import { allocate, toCents } from '../src/domain/money.js';
import { simplifyDebts } from '../src/domain/settle.js';
import { computeSplits } from '../src/domain/splits.js';

describe('money', () => {
  it('converts decimals to cents exactly', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1_000_000)).toBe(100_000_000);
  });

  it('rejects sub-cent precision', () => {
    expect(() => toCents(1.005)).toThrow(/two decimal/);
  });

  it('allocate always sums to the total and spreads remainder cents', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(7, [1, 1, 1, 1])).toEqual([2, 2, 2, 1]);
    expect(allocate(1, [1, 1])).toEqual([1, 0]);
    for (const total of [1, 99, 1001, 123457]) {
      for (const weights of [[1, 1, 1], [3, 1], [1, 2, 3, 4, 5], [50, 25, 25]]) {
        const parts = allocate(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every((p) => p >= 0)).toBe(true);
      }
    }
  });
});

describe('computeSplits', () => {
  const a = 'a', b = 'b', c = 'c';

  it('equal', () => {
    const s = computeSplits('equal', 1000, [{ userId: a }, { userId: b }, { userId: c }]);
    expect(s.map((x) => x.amountCents)).toEqual([334, 333, 333]);
  });

  it('exact must add up', () => {
    expect(computeSplits('exact', 1000, [{ userId: a, value: 2.5 }, { userId: b, value: 7.5 }]).map((x) => x.amountCents)).toEqual([250, 750]);
    expect(() => computeSplits('exact', 1000, [{ userId: a, value: 2 }, { userId: b, value: 7.5 }])).toThrow(/add up/);
  });

  it('percent must total 100', () => {
    expect(computeSplits('percent', 999, [{ userId: a, value: 50 }, { userId: b, value: 50 }]).map((x) => x.amountCents)).toEqual([500, 499]);
    expect(() => computeSplits('percent', 999, [{ userId: a, value: 60 }, { userId: b, value: 50 }])).toThrow(/100/);
  });

  it('shares are proportional', () => {
    expect(computeSplits('shares', 3000, [{ userId: a, value: 2 }, { userId: b, value: 1 }]).map((x) => x.amountCents)).toEqual([2000, 1000]);
    expect(() => computeSplits('shares', 3000, [{ userId: a, value: 1.5 }, { userId: b, value: 1 }])).toThrow(/integer/);
  });

  it('rejects duplicates and empties', () => {
    expect(() => computeSplits('equal', 100, [])).toThrow();
    expect(() => computeSplits('equal', 100, [{ userId: a }, { userId: a }])).toThrow(/Duplicate/);
  });
});

describe('simplifyDebts', () => {
  it('returns nothing when everyone is settled', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('collapses chains into at most n-1 transfers', () => {
    // a owes b 10, b owes c 10  -> a pays c 10
    const transfers = simplifyDebts({ a: -1000, b: 0, c: 1000 });
    expect(transfers).toEqual([{ from: 'a', to: 'c', amountCents: 1000 }]);
  });

  it('matches largest debtor with largest creditor and balances out exactly', () => {
    const net = { a: 5000, b: -2000, c: -3000, d: 1500, e: -1500 };
    const transfers = simplifyDebts(net);
    expect(transfers.length).toBeLessThanOrEqual(4);
    const check = { ...net };
    for (const t of transfers) {
      check[t.from] += t.amountCents;
      check[t.to] -= t.amountCents;
    }
    expect(Object.values(check).every((v) => v === 0)).toBe(true);
  });
});
