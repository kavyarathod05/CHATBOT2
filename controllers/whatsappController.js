const { sendMessage } = require('../utils/whatsappAPI');

exports.receiveMessage = async (req, res) => {
  try {
    // Log the full incoming request to see its structure
    // console.log(JSON.stringify(req.body, null, 2));  // Debugging log

    // Safely access entry and changes data
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;

    // Check if the request contains 'messages' (incoming message data)
    const messages = value && value.messages && value.messages[0];
    if (messages) {
      // If incoming message is found, process it
      const userPhone = messages.from;  // Phone number of the sender
      const messageText = messages.text ? messages.text.body.toLowerCase() : '';  // Safely access message text

      console.log('Received message from:', userPhone);
      console.log('Message text:', messageText);

      // Handle different types of incoming messages
      if (messageText === 'hi' || messageText === 'hello') {
        // Send a welcome message with an image
        const welcomeText = "Hi there! Welcome to Nani's Bilona Ghee. How can we assist you today? Type 'help' for options.";
        const imageUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQXaekK87HoROClCOCn3UAEwvmxcHSOdTKqg&s';  // Replace with your image URL
        const videoUrl = ""

        const messageData = {
          text: welcomeText,
          media: [
            {
              type: 'image',
              url: imageUrl,
            },
          ]
        };

        // Send both text and image
        await sendMessage(userPhone, messageData);
      } else if (messageText.includes('help')) {
        // Respond with an interactive menu for help
        const interactiveMessage = {
          text: "How can we assist you today? Please choose an option below:",
          buttons: [
            { id: 'buy_ghee', title: 'Buy Ghee Options' },
            { id: 'subscription_plans', title: 'Subscription Plans' },
            { id: 'contact_support', title: 'Talk to Founder' },
          ]
        };
        await sendMessage(userPhone, interactiveMessage);
      } else {
        // Default message if no recognized text
        await sendMessage(userPhone, { text: "I'm here to help! Type 'help' if you need assistance." });
      }
      return res.sendStatus(200); // Acknowledge receipt of the message
    }

    // If the request contains 'statuses' (message delivery status updates)
    const statuses = value && value.statuses;
    if (statuses) {
      statuses.forEach(status => {
        const messageId = status.id;
        const statusValue = status.status;
        const recipientId = status.recipient_id;

        // Handle the status update
        // console.log(`Message ID: ${messageId}, Status: ${statusValue}, Recipient ID: ${recipientId}`);
        
        // Example: You can implement logic based on the message status
        if (statusValue === 'sent') {
          // Logic for when a message is sent
        } else if (statusValue === 'delivered') {
          // Logic for when a message is delivered
        }
      });
      return res.sendStatus(200); // Acknowledge receipt of the status update
    }

    // If neither 'messages' nor 'statuses' are found, return an error
    console.error('Neither messages nor statuses data found');
    res.sendStatus(400); // Bad request, invalid data

  } catch (error) {
    console.error('Error processing the message:', error);
    res.sendStatus(500);  // Internal server error if something goes wrong
  }
};
