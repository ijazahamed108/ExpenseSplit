import Balance from '../models/Balance.js';
import Expense from '../models/Expense.js';

const balanceCache = new Map();

// Author: Ijaz Ahamed
// This function updates the balance information between friends after an expense has been added, including repayments.

export const updateBalances = async (expenseId, repayments = []) => {
    try {
      // Fetch the expense details from the database and populate the 'friends' field
      const expense = await Expense.findById(expenseId).populate('friends');
  
      // Calculate the individual share of the expense based on the total expense and the number of friends
      const totalFriends = expense.friends.length;
      const individualShare = expense.totalExpense / totalFriends;
  
      // Loop through each friend involved in the expense
      for (const friend of expense.friends) {
        // Try to get the existing balance information for the friend from the cache
        let balance = balanceCache.get(friend._id);
  
        // If no existing balance, fetch from the database or create a new balance entry
        if (!balance) {
          balance = await Balance.findOne({ userId: friend._id });
  
          if (!balance) {
            balance = new Balance({ userId: friend._id, owes: [], owedBy: [] });
          }
  
          // Cache the balance for future use
          balanceCache.set(friend._id, balance);
        }
  
        // Loop through other friends to update balances
        for (const otherFriend of expense.friends) {
          // Skip if the current friend is the same as the otherFriend
          if (friend._id.equals(otherFriend._id)) {
            continue;
          }
  
          // Check if an existing 'owe' entry exists for this friend
          const existingOwe = balance.owes.find((owe) => owe.friendId.equals(otherFriend._id));
  
          // Check if an existing 'owedBy' entry exists for this friend
          const existingOwedBy = balance.owedBy.find((owedBy) => owedBy.friendId.equals(otherFriend._id));
  
          // Update existing 'owe' entry or create a new one
          if (existingOwe) {
            existingOwe.amount += individualShare;
          } else {
            balance.owes.push({ friendId: otherFriend._id, amount: individualShare });
          }
  
          // Update existing 'owedBy' entry or create a new one
          if (existingOwedBy) {
            existingOwedBy.amount += individualShare;
          } else {
            balance.owedBy.push({ friendId: otherFriend._id, amount: individualShare });
          }
        }
  
        // Handle repayments for this friend
        for (const repayment of repayments) {
          if (friend._id.equals(repayment.userId)) {
            const owedByIndex = balance.owedBy.findIndex((owedBy) => owedBy.friendId.equals(repayment.friendId));
            if (owedByIndex !== -1) {
              balance.owedBy[owedByIndex].amount -= repayment.amount;
            }
          }
        }
  
        // Save the updated balance information in the database
        await balance.save();
      }
    } catch (error) {
      // Handle any errors that occur during the process
      console.error('Error updating balances:', error);
    }
  };
  
  
