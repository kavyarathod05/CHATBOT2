const { sendMessage } = require('../utils/whatsappAPI');
const User = require('../models/User');  // Adjust the path if necessary
const Subscription = require('../models/Subscription');  // Adjust the path if necessary
const Payment = require('../models/Payment');  // Adjust the path if necessary
const Order = require('../models/Order');  // Adjust the path if necessary
const buttonHandlers = require('../handlers/buttonHandlers'); // Import button handlers
const { generatePaymentLinkWithDivision } = require("../razorpay/razorpay.js")
const Razorpay = require('razorpay');

const userStates = {};
const useradd = {};
let userAmount;
const planType = {};

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
          phone: userPhone,  // Save the phone number
        });
        await user.save();
        console.log(`New user added: ${userPhone}`);
      }

      if (userStates[userPhone] === 'awaiting_custom_amount_A2') {
        console.log("cow");

        // Call handleCustomAmountInput to process the entered amount
        await handleCustomAmountInput_A2(messageText, userPhone);
        // delete userStates[userPhone]; // Clear state after processing
        return res.sendStatus(200);
      }

      else if (userStates[userPhone] === 'awaiting_custom_amount_buffalo') {
        console.log("buffalo");

        // Call handleCustomAmountInput to process the entered amount
        await handleCustomAmountInput_buffalo(messageText, userPhone);
        // delete userStates[userPhone]; // Clear state after processing
        return res.sendStatus(200);
      }

      else if (userStates[userPhone] === 'awaiting_custom_amount_plan_buffalo') {
        console.log("buffalo");

        // Call handleCustomAmountInput to process the entered amount
        await handleCustomAmountInput_plan_buffalo(messageText, userPhone);
        // delete userStates[userPhone]; // Clear state after processing
        return res.sendStatus(200);
      }

      else if (userStates[userPhone] === 'awaiting_custom_amount_plan_A2') {
        console.log("buffalo");

        // Call handleCustomAmountInput to process the entered amount
        await handleCustomAmountInput_plan_A2(messageText, userPhone);
        // delete userStates[userPhone]; // Clear state after processing
        return res.sendStatus(200);
      }

      // console.log(useradd[userPhone]);
      console.log(planType);
      
      if (useradd[userPhone] === 'awaiting_address') {
        console.log("cow");
        console.log(messageText);
        await handleAddressInput(messageText, userPhone);
        return res.sendStatus(200);
      }

      else if (useradd[userPhone] === "awaiting_edit_address") {
        await handleAddressInput(messageText, userPhone);
        return res.sendStatus(200);
      }

      else if (useradd[userPhone] === 'awaiting_subscription_date') {
        console.log("Date Called")
        await handleSubscriptionDateInput(messageText, userPhone);
        delete useradd[userPhone];
        return res.sendStatus(200);
      }

      // Ask for address if user starts subscription flow



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

          if (buttonId.includes("_planA2")) {
            console.log("plan a2");

            let amount = 1;

            if (buttonId === "small_planA2") amount *= 500;
            else if (buttonId === "medium_planA2") amount *= 1000;
            else if (buttonId === "large_planA2") amount *= 2000;
            else if (buttonId === "custom_planA2") {
              userStates[userPhone] = 'awaiting_custom_amount_plan_A2';
              const message = {
                text: "Please enter the amount you want to order (should be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return;
            }

            useradd[userPhone] = 'awaiting_address';
            userAmount = amount;
            planType[userPhone] = "plan_A2"
            const message = { text: 'Please provide your address for subscription.' };
            await sendMessage(userPhone, message);
            return;

            // Use the amount multiplier to create the subscription
            // await createSubscriptionA2(userPhone, amount);
          }

          else if (buttonId.includes("_A2")) {
            console.log("no plan A2");
            let amount = 350;
            if (buttonId == "small_A2") amount *= 500;
            else if (buttonId == "medium_A2") amount *= 1000;
            else if (buttonId == "large_A2") amount *= 2000;
            else if (buttonId == "plan_A2") {
              if (messages.interactive && messages.interactive.button_reply) {
                const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
                console.log(buttonId);

                return await buttonHandlers.handleBuyGheePlanQuantity(userPhone, buttonId);
              }

            }
            else if (buttonId == "custom_A2") {
              userStates[userPhone] = 'awaiting_custom_amount_A2';
              const message = {
                text: "Please enter the amount you want to Order (shoud be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return res.sendStatus(200); // Await custom input
            }
            useradd[userPhone] = 'awaiting_address';
            userAmount = amount;
            planType[userPhone] = "A2";
            const message = { text: 'Please provide your address.' };
            await sendMessage(userPhone, message);
            return;

          }

          if (buttonId.includes("_planbuffalo")) {
            console.log("plan_buffalo");
            let amount = 1;

            if (buttonId === "small_planbuffalo") amount *= 500;
            else if (buttonId === "medium_planbuffalo") amount *= 1000;
            else if (buttonId === "large_planbuffalo") amount *= 2000;
            else if (buttonId === "custom_planbuffalo") {
              userStates[userPhone] = 'awaiting_custom_amount_plan_buffalo';
              const message = {
                text: "Please enter the amount you want to order (should be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return;
            }
            useradd[userPhone] = 'awaiting_address';
            userAmount = amount;
            planType[userPhone] = "plan_buffalo"
            const message = { text: 'Please provide your address for Subscription.' };
            await sendMessage(userPhone, message);
            return;

            // Use the amount multiplier to create the subscription
            // await createSubscriptionBuffalo(userPhone, amount);
          }

          else if (buttonId.includes("_buffalo")) {
            console.log("no plan buffalo");
            let amount = 400;
            if (buttonId == "small_buffalo") amount *= 500;
            else if (buttonId == "medium_buffalo") amount *= 1000;
            else if (buttonId == "large_buffalo") amount *= 2000;
            else if (buttonId == "plan_buffalo") {
              if (messages.interactive && messages.interactive.button_reply) {
                const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
                console.log(buttonId);

                return await buttonHandlers.handleBuyGheePlanQuantity(userPhone, buttonId);
              }
            }
            else if (buttonId == "custom_buffalo") {
              userStates[userPhone] = 'awaiting_custom_amount_buffalo';
              const message = {
                text: "Please enter the amount you want to Order (shoud be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return res.sendStatus(200); // Await custom input
            }
            useradd[userPhone] = 'awaiting_address';
            userAmount = amount;
            planType[userPhone] = "buffalo"
            const message = { text: 'Please provide your address.' };
            await sendMessage(userPhone, message);
            return;

          }

          if (buttonId.includes("_address")) {
            if (buttonId === "edit_address") {
              useradd[userPhone] = 'awaiting_edit_address';
              const message = {
                text: "Please provide your new address",
              };
              await sendMessage(userPhone, message)
              console.log(useradd[userPhone]);
              return;
            }
            else if (buttonId === "same_address") {
              useradd[userPhone] = 'awaiting_same_address';
              const message = {
                text: "Continuing with The same address....",
              };
              await sendMessage(userPhone, message)
              console.log(useradd[userPhone]);
              await handleAddressInput("same address", userPhone);
              return;
            }
            return;
          }



          if (buttonId === 'buy_ghee') {
            // Call the handler for "Buy Our Ghee"
            if (messages.interactive && messages.interactive.button_reply) {
              const buttonId = messages.interactive.button_reply.id;  // Button ID the user clicked
              console.log(buttonId);

              await buttonHandlers.handleBuyGhee(userPhone, buttonId);
            }

          } else if (buttonId === 'customer_support') {
            // Call the handler for "Customer Support"
            await buttonHandlers.handleCustomerSupport(userPhone);
          } else if (buttonId === 'b2b') {
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
  userStates[userPhone] = "";
  useradd[userPhone] = 'awaiting_address';
  userAmount = amount;
  planType[userPhone] = "A2"
  const message = { text: 'Please provide your address.' };
  await sendMessage(userPhone, message);
  return;

  // const description = "Custom Amount Purchase of Ghee";

  // try {
  //   // Generate payment link with the custom amount
  //   const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

  //   const message = {
  //     text: `Please complete your purchase here: ${paymentLink}`,
  //   };

  //   await sendMessage(userPhone, message);
  // } catch (error) {
  //   console.error("Error sending custom payment link:", error);
  //   throw new Error("Failed to create custom payment link");
  // }
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
  userStates[userPhone] = "";
  useradd[userPhone] = 'awaiting_address';
  userAmount = amount;
  planType[userPhone] = "buffalo"
  const message = { text: 'Please provide your address.' };
  await sendMessage(userPhone, message);
  return;



  // const description = "Custom Amount Purchase of Ghee";

  // try {
  //   // Generate payment link with the custom amount
  //   const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

  //   const message = {
  //     text: `Please complete your purchase here: ${paymentLink}`,
  //   };

  //   await sendMessage(userPhone, message);
  // } catch (error) {
  //   console.error("Error sending custom payment link:", error);
  //   throw new Error("Failed to create custom payment link");
  // }
}


// Custom amount input handler for Buffalo Ghee
async function handleCustomAmountInput_plan_buffalo(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  console.log("input_plan_buffalo");
  amount *= 1;

  if (isNaN(amount) || amount % 500 !== 0) {
    const errorMessage = {
      text: "Please enter a valid amount divisible by 500.",
    };
    await sendMessage(userPhone, errorMessage);
    return;
  }
  userStates[userPhone] = "";
  useradd[userPhone] = 'awaiting_address';
  userAmount = amount;
  planType[userPhone] = "plan_A2"
  const message = { text: 'Please provide your address for subscription.' };
  await sendMessage(userPhone, message);
  return;
  // Use the custom amount to create the subscription
  // await createSubscriptionBuffalo(userPhone, amount);
}

// Custom amount input handler for A2 Cow Ghee
async function handleCustomAmountInput_plan_A2(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  console.log("plan_input_A2");
  amount *= 1;

  if (isNaN(amount) || amount % 500 !== 0) {
    const errorMessage = {
      text: "Please enter a valid amount divisible by 500.",
    };
    await sendMessage(userPhone, errorMessage);
    return;
  }
  userStates[userPhone] = "";
  useradd[userPhone] = 'awaiting_address';
  userAmount = amount;
  planType[userPhone] = "plan_A2"
  const message = { text: 'Please provide your address for subscription.' };
  await sendMessage(userPhone, message);
  return;

  // Use the custom amount to create the subscription
  // await createSubscriptionA2(userPhone, amount);
}

// Initialize Razorpay with your API credentials
const razorpayInstance = new Razorpay({
  key_id: 'rzp_test_QgUWVxoBmFqwYe',
  key_secret: 'GH4s895V1dCT9COR25iG2JoY',
});

// Define plan IDs for subscriptions
const PLAN_ID_BUFFALO = 'plan_PJbyRozbzkR06G';
const PLAN_ID_A2 = 'plan_PJbyRozbzkR06G';

// // Function to create a subscription for Buffalo Ghee
// async function createSubscriptionBuffalo(userPhone, amountMultiplier) {
//   const description = "Monthly Subscription of Buffalo Ghee";

//   try {
//     const subscription = await razorpayInstance.subscriptions.create({
//       plan_id: PLAN_ID_BUFFALO,
//       customer_notify: 1,
//       quantity: amountMultiplier / 500,
//       total_count: 12,
//       notes: {
//         phone: userPhone,
//         description: description,
//       },
//     });

//     // Send subscription link to the user
//     const message = {
//       text: `You have now subscribed to Our Monthly Plan of Buffalo Ghee. Please complete your payment here to activate: ${subscription.short_url}`,
//     };
//     await sendMessage(userPhone, message);
//   } catch (error) {
//     console.error('Error creating subscription for Buffalo Ghee:', error);
//     const errorMessage = {
//       text: "Failed to create subscription. Please try again later.",
//     };
//     await sendMessage(userPhone, errorMessage);
//   }
// }

// // Function to create a subscription for A2 Cow Ghee
// async function createSubscriptionA2(userPhone, amountMultiplier) {
//   const description = "Monthly Subscription of A2 Cow Ghee";

//   try {
//     const subscription = await razorpayInstance.subscriptions.create({
//       plan_id: PLAN_ID_A2,
//       customer_notify: 1,
//       total_count: 12,
//       quantity: amountMultiplier / 500,
//       notes: {
//         phone: userPhone,
//         description: description,
//       },
//     });

//     // Send subscription link to the user
//     const message = {
//       text: `You have now subscribed to Our Monthly Plan of A2 Cow Ghee. Please complete your payment here to activate: ${subscription.short_url}`,
//     };
//     await sendMessage(userPhone, message);
//   } catch (error) {
//     console.error('Error creating subscription for A2 Cow Ghee:', error);
//     const errorMessage = {
//       text: "Failed to create subscription. Please try again later.",
//     };
//     await sendMessage(userPhone, errorMessage);
//   }
// }

async function createPayment_A2(userPhone, amount) {
  const description = "Purchase of Ghee";
  try {
    const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

    const message = {
      text: `Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
    return;
  } catch (error) {
    console.error('Error sending payment link:', error);
    res.sendStatus(500);
  }
}

async function createPayment_buffalo(userPhone, amount) {
  const description = "Purchase of Ghee";
  try {
    const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

    const message = {
      text: `Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
    return;
  } catch (error) {
    console.error('Error sending payment link:', error);
    res.sendStatus(500);
  }
}

async function createSubscriptionA2(userPhone, amountMultiplier) {
  const description = "Monthly Subscription of A2 Cow Ghee";

  try {
    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: PLAN_ID_A2,
      customer_notify: 1,
      total_count: 12,  // Example: 12-month subscription
      quantity: amountMultiplier / 500,
      notes: {
        phone: userPhone,
        description: description,
      },
    });

    const user = await User.findOne({ phone: userPhone });

    const message = {
      text: `You have now subscribed to Our Monthly Plan of A2 Cow Ghee. Your subscription will start on ${user.subscriptionStartDate.toDateString()} and will be delivered to the address: ${user.address}. Please complete your payment here to activate: ${subscription.short_url}`,
    };
    await sendMessage(userPhone, message);
  } catch (error) {
    console.error('Error creating subscription for A2 Cow Ghee:', error);
    const errorMessage = { text: "Failed to create subscription. Please try again later." };
    await sendMessage(userPhone, errorMessage);
  }
}

async function createSubscriptionBuffalo(userPhone, amountMultiplier) {
  const description = "Monthly Subscription of Buffalo Ghee";

  try {
    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: PLAN_ID_BUFFALO,
      customer_notify: 1,
      total_count: 12,  // Example: 12-month subscription
      quantity: amountMultiplier / 500,
      notes: {
        phone: userPhone,
        description: description,
      },
    });

    const user = await User.findOne({ phone: userPhone });

    const message = {
      text: `You have now subscribed to Our Monthly Plan of Buffalo Ghee. Your subscription will start on ${user.subscriptionStartDate.toDateString()} and will be delivered to the address: ${user.address}. Please complete your payment here to activate: ${subscription.short_url}`,
    };
    await sendMessage(userPhone, message);
  } catch (error) {
    console.error('Error creating subscription for A2 Cow Ghee:', error);
    const errorMessage = { text: "Failed to create subscription. Please try again later." };
    await sendMessage(userPhone, errorMessage);
  }
}








// Handle address input
async function handleAddressInput(messageText, userPhone) {

  const user = await User.findOne({ phone: userPhone });
  if (useradd[userPhone] === "awaiting_address" || useradd[userPhone] === "awaiting_edit_address") {
    // const user = await User.findOne({ phone: userPhone });

    if (user) {
      user.address = messageText;
      await user.save();
    }
  }


  if (useradd[userPhone] === "awaiting_address") {
    useradd[userPhone] = "";
    const rewriteAddress = {
      text: "Want to Edit your Address!??",
      buttons: [
        {
          id: "edit_address",
          title: "Edit Address"
        },
        {
          id: "same_address",
          title: "Same Address"
        }
      ]
    };

    // Send button message with the two ghee options
    // console.log(rewriteAddress);
    await sendMessage(userPhone, rewriteAddress);
    return;
  }


  if (useradd[userPhone] === "awaiting_same_address" || useradd[userPhone] === "awaiting_edit_address") {
    let message;
    console.log(user.address);

    if (planType[userPhone] === "plan_buffalo" || planType[userPhone] === "plan_A2") {
      message = {
        text: "Thank you for providing your address! Now, let us know the date you'd like to start your subscription (format: YYYY-MM-DD).",
      };

      // Update user state to await subscription date

      useradd[userPhone] = 'awaiting_subscription_date';
      await sendMessage(userPhone, message);
      return;
    }


    else {
      useradd[userPhone] = '';
      message = {
        text: "Thank you for providing your address! We will deliver your Order ASAP",
      };
      await sendMessage(userPhone, message);
      if (planType[userPhone] === "A2")
        await createPayment_A2(userPhone, userAmount);
      if (planType[userPhone] === "buffalo")
        await createPayment_buffalo(userPhone, userAmount);
      return;
    }
  }

  return;
}

// Handle subscription date input
async function handleSubscriptionDateInput(messageText, userPhone) {
  const subscriptionDate = new Date(messageText);

  // Validate the date format
  if (isNaN(subscriptionDate.getTime())) {
    const errorMessage = { text: "Please enter a valid date (e.g., YYYY-MM-DD)." };
    await sendMessage(userPhone, errorMessage);
    return;
  }

  const user = await User.findOne({ phone: userPhone });
  if (user) {
    user.subscriptionStartDate = subscriptionDate;
    await user.save();
  }

  const message = {
    text: `Your subscription will start on ${subscriptionDate.toDateString()}. Pay to Subscribe`,
  };
  await sendMessage(userPhone, message);

  // Create subscription after collecting all info
  if (planType[userPhone] === "plan_A2") {
    console.log(planType[userPhone]);
    await createSubscriptionA2(userPhone, userAmount);
  }

  else if (planType[userPhone] === "plan_buffalo") {
    console.log(planType[userPhone]);
    await createSubscriptionBuffalo(userPhone, userAmount);

  }
}

// Create subscription using Razorpay

