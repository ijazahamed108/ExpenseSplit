import { unprocessable } from '../errors.js';

/** Convert a decimal amount (e.g. 12.34) to integer cents, rejecting sub-cent precision. */
export function toCents(amount) {
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) {
    throw unprocessable(`Amount ${amount} has more than two decimal places`);
  }
  return cents;
}

export const fromCents = (cents) => Math.round(cents) / 100;

/**
 * Split `totalCents` across participants proportionally to `weights`, guaranteeing the
 * parts sum exactly to the total. Uses the largest-remainder (Hamilton) method, so the
 * leftover cents go to the participants with the largest fractional share; ties are
 * broken by position so the result is deterministic.
 */
export function allocate(totalCents, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || totalWeight <= 0) {
    throw unprocessable('Allocation requires at least one participant with a positive weight');
  }

  const raw = weights.map((w) => (totalCents * w) / totalWeight);
  const floors = raw.map(Math.floor);
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0);

  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] += 1;
    remainder -= 1;
  }
  return floors;
}
