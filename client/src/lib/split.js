/** Client-side mirror of the server's largest-remainder allocation, for live previews only. */
export function allocateCents(totalCents, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (!weights.length || totalWeight <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / totalWeight);
  const floors = raw.map(Math.floor);
  let rem = totalCents - floors.reduce((a, b) => a + b, 0);
  raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .forEach(({ i }) => {
      if (rem > 0) {
        floors[i] += 1;
        rem -= 1;
      }
    });
  return floors;
}

export const toCents = (n) => Math.round((Number(n) || 0) * 100);

/**
 * Preview amounts per participant and a validation message (null when valid).
 * participants: [{ userId, value }] where value is already numeric.
 */
export function previewSplit(splitType, amount, participants) {
  const total = toCents(amount);
  if (!participants.length) return { amounts: [], error: 'Pick at least one participant' };
  if (total <= 0) return { amounts: participants.map(() => 0), error: 'Enter an amount' };

  switch (splitType) {
    case 'equal': {
      return { amounts: allocateCents(total, participants.map(() => 1)), error: null };
    }
    case 'exact': {
      const cents = participants.map((p) => toCents(p.value));
      const sum = cents.reduce((a, b) => a + b, 0);
      const diff = total - sum;
      return { amounts: cents, error: diff === 0 ? null : diff > 0 ? `${(diff / 100).toFixed(2)} left to assign` : `${(-diff / 100).toFixed(2)} over the total`, remaining: diff };
    }
    case 'percent': {
      const pct = participants.map((p) => Number(p.value) || 0);
      const sum = pct.reduce((a, b) => a + b, 0);
      const diff = +(100 - sum).toFixed(2);
      return { amounts: Math.abs(diff) < 0.01 ? allocateCents(total, pct) : pct.map(() => 0), error: Math.abs(diff) < 0.01 ? null : diff > 0 ? `${diff}% left to assign` : `${-diff}% over 100%`, remaining: diff };
    }
    case 'shares': {
      const w = participants.map((p) => Math.max(0, Math.floor(Number(p.value) || 0)));
      const sum = w.reduce((a, b) => a + b, 0);
      return { amounts: sum > 0 ? allocateCents(total, w) : w.map(() => 0), error: sum > 0 ? null : 'Give at least one person a share' };
    }
    default:
      return { amounts: [], error: 'Unknown split type' };
  }
}
