import Balance from '../models/Balance.js';

export const getBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const balance = await Balance.findOne({ userId }).populate('owes.friendId owedBy.friendId');
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch balance' });
  }
};
