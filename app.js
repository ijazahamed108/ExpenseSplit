import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import userRoutes from './routes/userRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import balanceRoutes from './routes/balanceRoutes.js';
import repayRoutes from './routes/repayRoutes.js';
const app = express();
app.use(bodyParser.json());

mongoose.connect('mongodb://localhost:27017/expense-splitter', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use('/users', userRoutes);
app.use('/expenses', expenseRoutes);
app.use('/balances', balanceRoutes);
app.use('/repayments', repayRoutes); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
