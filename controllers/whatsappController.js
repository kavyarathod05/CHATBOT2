const { sendMessage } = require('../utils/whatsappAPI');
const User = require('../models/User');  // Adjust the path if necessary
const buttonHandlers = require('../handlers/buttonHandlers'); // Import button handlers

exports.receiveMessage = async (req, res) => {
  try {
    // Safely access entry and changes data
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;

    // Check if the request contains 'messages' (incoming message data)
    const messages = value && value.messages && value.messages[0];
    if (messages) {
      const userPhone = messages.from;  // Phone number of the sender
      const messageText = messages.text ? messages.text.body.toLowerCase() : '';  // Safely access message text

      // Check if the user already exists in the database
      let user = await User.findOne({ phone: userPhone });

      // If the user doesn't exist, create a new one
      if (!user) {
        user = new User({
          userPhone: userPhone,  // Save the phone number
        });
        await user.save();
        console.log(`New user added: ${userPhone}`);
      }

      // Handle different types of incoming messages
      if (messageText === 'hi' || messageText === 'hello' || messageText === 'Hi') {
        // Send a welcome message
        const welcomeText = "Hi there! Welcome to Nani's Bilona Ghee. How can we assist you today? Type 'help' for options.";
        const imageUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQXaekK87HoROClCOCn3UAEwvmxcHSOdTKqg&s';  // Replace with your image URL

        const messageData = {
          text: welcomeText,
          media: [
            {
              type: 'image',
              url: imageUrl,
            },
          ],
          interactive: {
            type: 'button',
            body: {
              text: "Need help? Click below.",
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: 'help_button',
                    title: 'Help',
                  },
                },
              ],
            },
          },
        };

        await sendMessage(userPhone, messageData);

      } else if (messageText.includes('help')) {
        // Respond with an interactive menu for help
        const message1 = {
          text: "How can we assist you today? Please choose an option below:",
          buttons: [
            { id: 'buy_ghee', title: 'Buy Our Ghee' },
            { id: 'subscription_plans', title: 'Customer Support' },
            { id: 'contact_support', title: 'B2B' }
          ]
        };

        const message2 = {
          text: "Existing Customer?",
          buttons: [
            { id: 'view_plans', title: 'View Your Plans' }
          ]
        };

        // Send the messages sequentially
        await sendMessage(userPhone, message1);
        await sendMessage(userPhone, message2);

      } else if (messages.interactive && messages.interactive.button_reply) {
        const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
        console.log(buttonId);
        

        if (buttonId) {
          if(buttonId == "A2_ghee" || buttonId == "buffalo"){
            if (messages.interactive && messages.interactive.button_reply) {
              const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
              console.log(buttonId);

              await buttonHandlers.handleBuyGheeQuantity(userPhone, buttonId);
          }}
          if (buttonId === 'buy_ghee') {
            // Call the handler for "Buy Our Ghee"
            if (messages.interactive && messages.interactive.button_reply) {
              const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
              console.log(buttonId);

              await buttonHandlers.handleBuyGhee(userPhone, buttonId);
            }
            
          } else if (buttonId === 'subscription_plans') {
            // Call the handler for "Customer Support"
            await buttonHandlers.handleCustomerSupport(userPhone);
          } else if (buttonId === 'contact_support') {
            // Call the handler for "B2B"
            await buttonHandlers.handleB2B(userPhone);
          }
        }

        return res.sendStatus(200); // Acknowledge receipt of the button interaction

      } else {
        // Default message if no recognized text
        console.log(messages);
        await sendMessage(userPhone, { text: "I'm here to help! Type 'help' if you need assistance." });
      }

      return res.sendStatus(200); // Acknowledge receipt of the message
    }

    res.sendStatus(400); // Bad request, invalid data

  } catch (error) {
    console.error('Error processing the message:', error);
    res.sendStatus(500);  // Internal server error if something goes wrong
  }
};
