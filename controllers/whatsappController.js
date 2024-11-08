const { sendMessage } = require('../utils/whatsappAPI');
const User = require('../models/User');  // Adjust the path if necessary
const buttonHandlers = require('../handlers/buttonHandlers'); // Import button handlers
const { generatePaymentLinkWithDivision } = require("../razorpay/razorpay.js")

const userStates = {};

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

      if (userStates[userPhone] === 'awaiting_custom_amount_A2') {
        console.log("cow");
        
        // Call handleCustomAmountInput to process the entered amount
        await handleCustomAmountInput_A2(messageText, userPhone);
        delete userStates[userPhone]; // Clear state after processing
        return res.sendStatus(200);
      }

      else if (userStates[userPhone] === 'awaiting_custom_amount_buffalo') {
        console.log("buffalo");
        
        // Call handleCustomAmountInput to process the entered amount
        await handleCustomAmountInput_buffalo(messageText, userPhone);
        delete userStates[userPhone]; // Clear state after processing
        return res.sendStatus(200);
      }

      // else if (userStates[userPhone] === 'awaiting_address') {
      //   console.log("ADDRESS");

      //   // console.log(`User state for ${userPhone} after clearing: ${userStates[userPhone]}`);
      //   await handleAddressInput(messageText, userPhone);  // Handle the address input
      //   delete userStates[userPhone]; // Clear state after processing
      //   // console.log(`User state for ${userPhone} after clearing: ${userStates[userPhone]}`);
      //   return res.sendStatus(200);
      // }

      // Handle different types of incoming messages
      if (messageText == "hi" || messageText == "hello" || messageText == "help") {
        // Send a welcome message
        const welcomeText = "Hi there! Welcome to Nani's Bilona Ghee. How can we assist you today?";
        const imageUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQXaekK87HoROClCOCn3UAEwvmxcHSOdTKqg&s';  // Replace with your image URL

        const messageData = {
          text: welcomeText,
          media: [
            {
              type: 'image',
              url: imageUrl,
            },
          ],
          buttons: [
            { id: 'help', title: 'Need help!!' },
          ]
        };


        await sendMessage(userPhone, messageData);

      } else if (messages.interactive && messages.interactive.button_reply) {
        const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
        console.log(buttonId);


        if (buttonId) {
          if (buttonId == "help") {
            // Respond with an interactive menu for help
            const message1 = {
              text: "How can we assist you today? Please choose an option below:",
              buttons: [
                { id: 'buy_ghee', title: 'Buy Our Ghee' },
                { id: 'subscription_plans', title: 'Customer Support' },
                { id: 'contact_support', title: 'B2B' },
              ]
            };

            // const message2 = {
            //   text: "Existing Customer?",
            //   buttons: [
            //     { id: 'view_plans', title: 'View Your Plans' }
            //   ]
            // };

            // Send the messages sequentially
            await sendMessage(userPhone, message1);
            // await sendMessage(userPhone, message2);
          }

          if (buttonId == "A2_ghee" || buttonId == "buffalo") {
            if (messages.interactive && messages.interactive.button_reply) {
              const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
              console.log(buttonId);

              await buttonHandlers.handleBuyGheeQuantity(userPhone, buttonId);
            }
          }

          if (buttonId.includes("_A2")) {
            let amount = 350;
            if (buttonId == "small_A2") amount *= 500;
            else if (buttonId == "medium_A2") amount *= 1000;
            else if (buttonId == "large_A2") amount *= 2000;
            else if (buttonId == "custom_A2") {
              userStates[userPhone] = 'awaiting_custom_amount_A2';
              const message = {
                text: "Please enter the amount you want to Order (shoud be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return res.sendStatus(200); // Await custom input
            }
            const description = "Purchase of Ghee";
            try {
              const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

              const message = {
                text: `Please complete your purchase here: ${paymentLink}`,
              };

              await sendMessage(userPhone, message);
              return res.sendStatus(200);
            } catch (error) {
              console.error('Error sending payment link:', error);
              res.sendStatus(500);
            }
          }

          if (buttonId.includes("_buffalo")) {
            let amount = 400;
            if (buttonId == "small_buffalo") amount *= 500;
            else if (buttonId == "medium_buffalo") amount *= 1000;
            else if (buttonId == "large_buffalo") amount *= 2000;
            else if (buttonId == "custom_buffalo") {
              userStates[userPhone] = 'awaiting_custom_amount_buffalo';
              const message = {
                text: "Please enter the amount you want to Order (shoud be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return res.sendStatus(200); // Await custom input
            }
            const description = "Purchase of Ghee";
            try {
              const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

              const message = {
                text: `Please complete your purchase here: ${paymentLink}`,
              };

              await sendMessage(userPhone, message);
              return res.sendStatus(200);
            } catch (error) {
              console.error('Error sending payment link:', error);
              res.sendStatus(500);
            }
          }

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
        await sendMessage(userPhone, {
          text: "Click if you need any type if help!!",
          buttons: [
            { id: 'help', title: 'Need help!!' },
          ]
        });
      }

      return res.sendStatus(200); // Acknowledge receipt of the message
    }

    res.sendStatus(400); // Bad request, invalid data

  } catch (error) {
    console.error('Error processing the message:', error);
    res.sendStatus(500);  // Internal server error if something goes wrong
  }
};

// Function to process custom amount input from the user
async function handleCustomAmountInput_A2(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  console.log("a2");

  amount *= 350;
  if (isNaN(amount) || amount <= 0) {
    // Send error message if the input is not a valid positive number
    const errorMessage = {
      text: "Please enter a valid amount.",
    };
    await sendMessage(userPhone, errorMessage);
    return;
  }

  const description = "Custom Amount Purchase of Ghee";

  try {
    // Generate payment link with the custom amount
    const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

    const message = {
      text: `Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
  } catch (error) {
    console.error("Error sending custom payment link:", error);
    throw new Error("Failed to create custom payment link");
  }
}


async function handleCustomAmountInput_buffalo(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  console.log("buffalo");
  amount *= 400;
  if (isNaN(amount) || amount <= 0) {
    // Send error message if the input is not a valid positive number
    const errorMessage = {
      text: "Please enter a valid amount.",
    };
    await sendMessage(userPhone, errorMessage);
    return;
  }

  const description = "Custom Amount Purchase of Ghee";

  try {
    // Generate payment link with the custom amount
    const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

    const message = {
      text: `Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
  } catch (error) {
    console.error("Error sending custom payment link:", error);
    throw new Error("Failed to create custom payment link");
  }
}

async function handleAddressInput(messageText, userPhone) {
  // Assuming messageText is the user’s address input

  // Save the address (you can store it in the database or in memory)
  let user = await User.findOne({ phone: userPhone });
  if (user) {
    user.address = messageText;  // Assuming you've added an `address` field to your User model
    await user.save();
  }

  // Generate the payment link after receiving the address
  try {
    const amount = userStates[userPhone] === 'awaiting_custom_amount_A2' ? 350 * 500 : 0;  // Replace with correct amount logic
    const description = "Custom Amount Purchase of Ghee";
    const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

    const message = {
      text: `Your order has been received. Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
  } catch (error) {
    console.error("Error sending payment link:", error);
    throw new Error("Failed to create custom payment link");
  }
}
