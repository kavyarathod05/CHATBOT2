const User = require('../models/User'); // Import the User model
const sendMessage = require('../send'); // Import the messaging function

async function sendMessagesToAllUsers(templateName, dynamicValue) {
  try {
    // Fetch all users with phone numbers
    const users = await User.find({}, 'phone name');

    // Iterate over users and send messages
    for (const user of users) {
      const phoneNumber = user.phone;
      const personalizedValue = `Hello ${user.name}, ${dynamicValue}`; // Example dynamic message
      const success = await sendMessage(phoneNumber, templateName, personalizedValue);

      if (success) {
      } else {
      }
    }
  } catch (error) {
  }
}

module.exports = sendMessagesToAllUsers;
