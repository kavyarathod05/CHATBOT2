const User = require('../models/User'); // Import the User model
const sendMessage = require('../send'); // Import the messaging function

async function sendMessagesToAllUsers(templateName, dynamicValue) {
  try {
    // Fetch all users with phone numbers
    const users = await User.find({}, 'phone name');
    console.log(`Found ${users.length} users in the database.`);

    // Iterate over users and send messages
    for (const user of users) {
      const phoneNumber = user.phone;
      const personalizedValue = `Hello ${user.name}, ${dynamicValue}`; // Example dynamic message
      const success = await sendMessage(phoneNumber, templateName, personalizedValue);

      if (success) {
        console.log(`Message successfully sent to ${user.name} (${phoneNumber}).`);
      } else {
        console.log(`Failed to send message to ${user.name} (${phoneNumber}).`);
      }
    }
  } catch (error) {
    console.error('Error sending messages:', error);
  }
}

module.exports = sendMessagesToAllUsers;
