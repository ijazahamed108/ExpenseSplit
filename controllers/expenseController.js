import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { updateBalances } from '../helpers/cacheHelper.js';

export const createExpense = async (req, res) => {
  try {
    const { totalExpense, friendIds } = req.body;
    const friends = await User.find({ _id: { $in: friendIds } });

    const expense = new Expense({ totalExpense, friends });
    await expense.save();

    await updateBalances(expense._id);

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Could not create expense' });
  }
};
