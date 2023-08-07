import mongoose from 'mongoose';

//Both First and Last name will be string
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
});

const User = mongoose.model('User', userSchema);

export default User;
