import User from '../models/User.js';

//To create a new User
// Stores new users in Users collection
//@Author: Ijaz
export const createUser = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const user = new User({ firstName, lastName });
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error in Creating  User' });
  }
};


// List All  users in Users collection
// Returns Array of objects Each object being a user
export const getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch users' });
  }
};
