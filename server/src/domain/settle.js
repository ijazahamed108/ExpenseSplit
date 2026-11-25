/**
 * Reduce a set of net balances to a minimal-ish list of transfers.
 *
 * Input:  { [userId]: netCents }  (positive = is owed money, negative = owes money; sums to 0)
 * Output: [{ from, to, amountCents }]
 *
 * Greedy "min cash flow": repeatedly match the largest debtor with the largest
 * creditor. Produces at most (n - 1) transfers, which is optimal for the common
 * case and never worse than the raw pairwise debts.
 */
export function simplifyDebts(netByUser) {
  const creditors = [];
  const debtors = [];
  for (const [userId, net] of Object.entries(netByUser)) {
    if (net > 0) creditors.push({ userId, amount: net });
    else if (net < 0) debtors.push({ userId, amount: -net });
  }
  creditors.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
  debtors.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) transfers.push({ from: debtor.userId, to: creditor.userId, amountCents: amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }
  return transfers;
}
