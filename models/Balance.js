import mongoose from 'mongoose';

const balanceSchema = new mongoose.Schema({
  userId: {
     type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  owes: [{ friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, amount: Number }],
  owedBy: [{ friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, amount: Number }],
});

const Balance = mongoose.model('Balance', balanceSchema);

export default Balance;
