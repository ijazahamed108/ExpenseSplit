import { unprocessable } from '../errors.js';
import { allocate, toCents } from './money.js';

export const SPLIT_TYPES = ['equal', 'exact', 'percent', 'shares'];

/**
 * Turn a split specification into concrete per-user cent amounts.
 *
 * @param {'equal'|'exact'|'percent'|'shares'} splitType
 * @param {number} totalCents
 * @param {Array<{userId: string, value?: number}>} participants
 *   - equal:   value ignored
 *   - exact:   value = amount in major units (must sum to total)
 *   - percent: value = percentage (must sum to 100)
 *   - shares:  value = positive share weight
 * @returns {Array<{userId: string, amountCents: number, shareValue: number|null}>}
 */
export function computeSplits(splitType, totalCents, participants) {
  if (!participants?.length) throw unprocessable('At least one participant is required');

  const ids = participants.map((p) => p.userId);
  if (new Set(ids).size !== ids.length) throw unprocessable('Duplicate participants in split');

  switch (splitType) {
    case 'equal': {
      const amounts = allocate(totalCents, participants.map(() => 1));
      return participants.map((p, i) => ({ userId: p.userId, amountCents: amounts[i], shareValue: null }));
    }

    case 'exact': {
      const cents = participants.map((p) => {
        if (typeof p.value !== 'number' || p.value < 0) throw unprocessable('Exact split needs a non-negative amount per participant');
        return toCents(p.value);
      });
      const sum = cents.reduce((a, b) => a + b, 0);
      if (sum !== totalCents) {
        throw unprocessable('Exact split amounts must add up to the expense total', {
          expectedCents: totalCents,
          receivedCents: sum,
        });
      }
      return participants.map((p, i) => ({ userId: p.userId, amountCents: cents[i], shareValue: p.value }));
    }

    case 'percent': {
      const pct = participants.map((p) => {
        if (typeof p.value !== 'number' || p.value < 0) throw unprocessable('Percent split needs a non-negative percentage per participant');
        return p.value;
      });
      const sum = pct.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.01) {
        throw unprocessable('Percentages must add up to 100', { received: Number(sum.toFixed(2)) });
      }
      const amounts = allocate(totalCents, pct);
      return participants.map((p, i) => ({ userId: p.userId, amountCents: amounts[i], shareValue: p.value }));
    }

    case 'shares': {
      const weights = participants.map((p) => {
        if (!Number.isInteger(p.value) || p.value < 0) throw unprocessable('Shares split needs a non-negative integer share per participant');
        return p.value;
      });
      const amounts = allocate(totalCents, weights);
      return participants.map((p, i) => ({ userId: p.userId, amountCents: amounts[i], shareValue: p.value }));
    }

    default:
      throw unprocessable(`Unknown split type: ${splitType}`);
  }
}
