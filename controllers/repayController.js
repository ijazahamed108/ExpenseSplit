import Balance from '../models/Balance.js';

export const recordRepayment = async (req, res) => {
  try {
    const { userId, friendId, amount } = req.body;

    // Find the balances for the user and friend
    const userBalance = await Balance.findOne({ userId });
    const friendBalance = await Balance.findOne({ userId: friendId });

    if (!userBalance || !friendBalance) {
      return res.status(404).json({ error: 'Balances not found' });
    }

    // Update the balances for repayment
    const userOweIndex = userBalance.owes.findIndex((owe) => owe.friendId.equals(friendId));
    const friendOwedByIndex = friendBalance.owedBy.findIndex((owedBy) => owedBy.friendId.equals(userId));

    if (userOweIndex !== -1 && friendOwedByIndex !== -1) {
      userBalance.owes[userOweIndex].amount -= amount;
      friendBalance.owedBy[friendOwedByIndex].amount -= amount;

      await userBalance.save();
      await friendBalance.save();

      res.json({ message: 'Repayment recorded successfully' });
    } else {
      res.status(400).json({ error: 'Invalid repayment details' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Could not record repayment' });
  }
};
