import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  totalExpense: Number,
  friends: [{
     type: mongoose.Schema.Types.ObjectId, ref: 'User'
     }],
});

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
