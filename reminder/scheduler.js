const cron = require('node-cron');
const User = require('../models/User'); // Adjust the path as needed
const { sendMessage } = require("../utils/whatsappAPI"); // Assuming sendMessage exists in utils

// Define the cron job function
function scheduleSubscriptionReminders() {
    console.log("|Scheduler working");
    
  cron.schedule('0 9 * * *', async () => { // Runs daily at 9 AM
    console.log("Running daily subscription reminder job");

    try {
      const today = new Date();
      const users = await User.find({
        nextReminderDate: { $lte: today }, // Find users with a reminder date today or earlier
      });

      for (const user of users) {
        // Send reminder message to the user
        const reminderMessage = {
          text: `Reminder: Your next subscription payment for A2 Cow Ghee is due soon. Please ensure your account has sufficient funds to avoid payment failures.`,
        };
        await sendMessage(user.phone, reminderMessage);

        // Calculate the next reminder date, assuming a monthly subscription cycle
        const nextReminderDate = new Date(user.nextReminderDate || user.subscriptionStartDate);
        nextReminderDate.setMonth(nextReminderDate.getMonth() + 1); // Advance by one month
        nextReminderDate.setDate(nextReminderDate.getDate() - 7); // Set to 7 days before the next cycle

        // Update user’s next reminder date
        user.nextReminderDate = nextReminderDate;
        await user.save();
      }
    } catch (error) {
      console.error("Error sending reminders:", error);
    }
  });
}

module.exports = scheduleSubscriptionReminders;
