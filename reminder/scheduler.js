const cron = require('node-cron');
const User = require('../models/User'); // Adjust the path as needed
const { sendMessage } = require("../utils/whatsappAPI"); // Assuming sendMessage exists in utils

// Define the cron job function
function scheduleSubscriptionReminders() {
  cron.schedule('0 9 * * * ', async () => { // Runs daily at 9 AM
   
    try {
      const today = new Date();
      const users = await User.find({
        nextReminderDate: { $lte: today }, // Find users with a reminder date today or earlier
      });

      for (const user of users) {
        // Send reminder message to the user
        const reminderMessage = {
          text: `Reminder: Your next subscription payment for Ghee is due soon. Please ensure your account has sufficient funds to avoid payment failures.`,
        };
        await sendMessage(user.phone, reminderMessage);

        // Calculate the next reminder date, assuming a monthly subscription cycle
        const nextReminderDate = new Date(user.nextReminderDate || user.subscriptionStartDate);
        nextReminderDate.setMonth(nextReminderDate.getMonth() + 1); // Advance by one month
        nextReminderDate.setDate(nextReminderDate.getDate() - 7);

        // Update user’s next reminder date
        user.nextReminderDate = nextReminderDate;
        return await user.save();
      }
    } catch (error) {
    }
    return;
  });
}

module.exports = scheduleSubscriptionReminders;
