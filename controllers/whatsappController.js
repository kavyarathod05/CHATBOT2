const { sendMessage } = require("../utils/whatsappAPI");
const User = require("../models/User"); // Adjust the path if necessar
const State = require("../models/State.js");
const buttonHandlers = require("../handlers/buttonHandlers"); // Import button handlers
const { generatePaymentLinkWithDivision } = require("../razorpay/razorpay.js");
const Razorpay = require("razorpay");
const PhoneNumber = require("../models/phoneNumber.js");

// Timeout duration in milliseconds (3 minutes)
const TIMEOUT_DURATION = 3 * 60 * 1000;

// Map to track timeouts for each user
const userTimeouts = new Map();

// Function to reset user state
const resetUserState = async (userPhone) => {
  try {
    const state = await State.findOne({ userPhone });
    if (state) {
      state.useredit = null;
      state.useradd = null;
      state.userState = null;
      state.planType = null;
      state.userAmount = null;
      await state.save();
    }
  } catch (error) {}
};

exports.receiveMessage = async (req, res) => {
  try {
    // Safely access entry and changes data
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;

    // Check if the request contains 'messages' (incoming message data)
    const messages = value && value.messages && value.messages[0];
    if (messages) {
      const messageId = messages.id; // Unique message ID provided by WhatsApp
      const userPhone = messages.from; // Phone number of the sender
      const messageText = messages.text ? messages.text.body.toLowerCase() : ""; // Safely access message text

      // Check if the user already exists in the database
      let user = await User.findOne({ phone: userPhone });
      let state = await State.findOne({ userPhone });

      if (!user) {
        user = new User({
          phone: userPhone, // Save the phone number
        });
        await user.save();
      }

      if (!state) {
        state = new State({
          userPhone,
        });

        await state.save();
      }

      // Clear the existing timeout for this user if any
      if (userTimeouts.has(userPhone)) {
        clearTimeout(userTimeouts.get(userPhone));
        userTimeouts.delete(userPhone);
      }

      // Set a new timeout for the user
      const timeout = setTimeout(async () => {
        await resetUserState(userPhone);
        const timeoutMessage = {
          text: "⚠️Session expired. Type 'Hi' to start again!",
        };
        await sendMessage(userPhone, timeoutMessage);
        userTimeouts.delete(userPhone); // Clean up the map
      }, TIMEOUT_DURATION);

      // Store the timeout in the map
      userTimeouts.set(userPhone, timeout);

      if (
        messageText.toLowerCase() === "hi" ||
        messageText.toLowerCase() === "hello" ||
        (messageText.toLowerCase() === "help" && messageId)
      ) {
        // Reset the user's state to ensure a fresh start
        await resetUserState(userPhone);

        // Construct the welcome message text
        const welcomeText =
          "👋 Hello! Welcome to Nani's Bilona Ghee. How can we help you today? 😊";

        // URL for the welcome image
        const imageUrl =
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQXaekK87HoROClCOCn3UAEwvmxcHSOdTKqg&s"; // Replace with your image URL
          const videoUrl = "https://rnfsl-117-250-157-213.a.free.pinggy.link/video/kj.mp4"; // Use the correct path served by Express
          // Message content to send to the user
        const messageData = {
          text: welcomeText,
          media: [
            {
              type: "image", // Image type for media
              url: imageUrl, // Image URL to be sent
            
            },
         

          ],
          buttons: [{ id: "help", title: "Need Help!" }],
        };
        const msg={
          text: "hi",
          media:[
            {
              type: "video",
              url:videoUrl // Text type for media
            }
          ]
        }

        // Send the message and handle potential errors
        try {
          await sendMessage(userPhone, msg);

          await sendMessage(userPhone, messageData);
          return res.status(200); // Return response if needed for further processing
        } catch (error) {
          throw new Error(`Failed to send welcome message to ${userPhone}`);
        }
      }

      if (state.username === "taking_name") {
        state.username = null;
        user.name = messageText;
        await state.save();
        await user.save();
        const message = {
          text: `Hello ${user.name}!! Click to continue 😊`,
          buttons: [{ id: "help", title: "Continue" }],
        };
        return await sendMessage(userPhone, message);
      }
      if (state.userState === "awaiting_custom_amount_A2") {
        return await handleCustomAmountInput_A2(messageText, userPhone);
      } else if (state.userState === "awaiting_custom_amount_buffalo") {
        return await handleCustomAmountInput_buffalo(messageText, userPhone);
      } else if (state.userState === "awaiting_custom_amount_plan_buffalo") {
        return await handleCustomAmountInput_plan_buffalo(
          messageText,
          userPhone
        );
      } else if (state.userState === "awaiting_custom_amount_plan_A2") {
        return await handleCustomAmountInput_plan_A2(messageText, userPhone);
      }
      if (state.useradd === "awaiting_address") {
        return await handleAddressInput(messageText, userPhone);
      } else if (state.useradd === "awaiting_edit_address") {
        return await handleAddressInput(messageText, userPhone);
      } else if (state.useradd === "awaiting_subscription_date") {
        await handleSubscriptionDateInput(messageText, userPhone);

        return await state.save();
      }
      if (state.useredit === "awaiting_edit_date") {
        const subscriptionDate = new Date(messageText);

        // Validate the date format
        if (isNaN(subscriptionDate.getTime())) {
          const errorMessage = {
            text: "Please enter a valid date (e.g., YYYY-MM-DD).",
          };
          return await sendMessage(userPhone, errorMessage);
          // Return here to stop further processing if date is invalid
        }

        const user = await User.findOne({ phone: userPhone });

        if (user) {
          // Update the date in your database
          user.subscriptionStartDate = subscriptionDate;
          await user.save();

          try {
            // Step 1: Cancel the old subscription if it exists
            if (user.subscriptionId) {
              await razorpayInstance.subscriptions.cancel(user.subscriptionId);
            }

            // Step 2: Create a new subscription with the updated date
            const newSubscription = await razorpayInstance.subscriptions.create(
              {
                plan_id: user.planId, // Use the existing plan ID from the user data
                customer_notify: 1,
                total_count: 12, // Example: 12-month subscription
                quantity: user.amountMultiplier / 500, // Adjust based on user data
                start_at: Math.floor(subscriptionDate.getTime() / 1000), // UNIX timestamp
                notes: {
                  phone: user.phone,
                  description: "Subscription with updated start date",
                },
              }
            );

            // Save the new subscription ID in the user's document
            user.subscriptionId = newSubscription.id;
            await user.save();

            // Step 3: Confirm success
            const message = {
              text: `🎉 Your subscription has been successfully updated!\n 
              Your new start date is ${subscriptionDate.toDateString()}.\n
              Complete your payment here: [${newSubscription.short_url}] 💳`,
            };
            return await sendMessage(userPhone, message);
          } catch (error) {
            const errorMessage = {
              text: "❌ Subscription update failed.\nPlease try again later. 🙏",
            };
            return await sendMessage(userPhone, errorMessage);
          }
        } else {
          const errorMessage = {
            text: "🚫 No user found with this phone number.\nPlease check and try again.",
          };
          return await sendMessage(userPhone, errorMessage);
          // Return if no user is found
        }
      }
      if (state.useredit === "awaiting_edit_address_existing") {
        // Update the user's address
        const user = await User.findOneAndUpdate(
          { phone: userPhone }, // Filter: find user by phone number
          { address: messageText }, // Update: set the new address value
          { new: true } // Option to return the updated user document
        );

        if (user) {
          const s = {
            text: "✅ Your address has been updated successfully!\nThank you for keeping your details up to date.",
          };
          return await sendMessage(userPhone, s);
        } else {
          const errorMessage = {
            text: "⚠️ There was an issue updating your address.\nPlease try again.",
          };
          return await sendMessage(userPhone, errorMessage);
        }
      }
      if (state.useredit === "awaiting_edit_quantity") {
        state.useredit = null;
        state.save();
        const newQuantity = parseInt(messageText, 10);

        // Validate the quantity format (must be a positive integer)
        if (isNaN(newQuantity) || newQuantity <= 0) {
          const errorMessage = {
            text: "⚠️ Please enter a valid quantity in ml.\nIt must be divisible by 500.",
          };
          await sendMessage(userPhone, errorMessage);
        }
        const user = await User.findOneAndUpdate(
          { phone: userPhone }, // Filter: find user by phone number
          { quantity: newQuantity }, // Update: set the new address value
          { new: true } // Option to return the updated user document
        );
        //   const user = await User.findOne({ phone: userPhone });

        if (user) {
          // Update the date in your database
          user.userOrderQuantity = newQuantity;
          await user.save();
          const subscriptionDate = user.subscriptionStartDate;

          try {
            // Step 1: Cancel the old subscription if it exists
            if (user.subscriptionId) {
              await razorpayInstance.subscriptions.cancel(user.subscriptionId);
            }

            // Step 2: Create a new subscription with the updated date
            const newSubscription = await razorpayInstance.subscriptions.create(
              {
                plan_id: user.planId, // Use the existing plan ID from the user data
                customer_notify: 1,
                total_count: 12, // Example: 12-month subscription
                quantity: newQuantity / 500, // Adjust based on user data
                start_at: Math.floor(subscriptionDate.getTime() / 1000), // UNIX timestamp
                notes: {
                  phone: user.phone,
                  description: "Subscription with updated start date",
                },
              }
            );

            // Save the new subscription ID in the user's document
            user.subscriptionId = newSubscription.id;
            await user.save();

            // Step 3: Confirm success
            const message = {
              text: `🎉 Your subscription has been updated successfully! The new start date is ${subscriptionDate.toDateString()}.\nPlease complete your payment here: ${
                newSubscription.short_url
              } 💳`,
            };
            return await sendMessage(userPhone, message);
          } catch (error) {
            const errorMessage = {
              text: "❌ Failed to update the quantity.\nPlease try again later.",
            };
            return await sendMessage(userPhone, errorMessage);
          }
        } else {
          const errorMessage = {
            text: "🚫 No user found with this phone number.\nPlease check and try again.",
          };
          return await sendMessage(userPhone, errorMessage);
        }
      }
      if (state.useredit === "awaiting_cancel_subscription") {
        state.useredit = null; // Clear the user status
        await state.save();

        try {
          const user = await User.findOne({ phone: userPhone });

          if (!user) {
            return;
          }

          if (user.subscriptionId) {
            // Attempt to cancel the subscription using Razorpay API
            try {
              await razorpayInstance.subscriptions.cancel(user.subscriptionId);

              const msg = {
                text: `✅ Your subscription (${user.subscriptionId}) cancelled successfully.\nThank you for using our service!`,
              };
              await sendMessage(userPhone, msg);
              user.subscription = false;
              user.subscriptionId = "";
              user.planId = "";
              return await user.save();
            } catch (error) {}
          } else {
          }
        } catch (error) {}

        return;
      }

      // Handle different types of incoming messages
      if (
        messages.interactive &&
        messages.interactive.button_reply &&
        messageId
      ) {
        const buttonId = messages.interactive.button_reply.id; // Button ID the user clicked

        if (buttonId) {
          if (buttonId === "help" || buttonId === "helpp") {
            // Respond with an interactive menu for help
            const user = await User.findOne({ phone: userPhone });

            const message1 = {
              text: `Hello ${user.name}! 👋 How can we assist you today?`,
              buttons: [
                { id: "buy_ghee", title: "Order Ghee" },
                { id: "customer_support", title: "Help & Support" },
                { id: "know_about_us", title: "B2B Services" },
              ],
            };

            const message2 = {
              text: `Hi ${user.name}! 👀 Want to check your plans?`,
              buttons: [{ id: "view_plans", title: "See Plans" }],
            };

            const message3 = {
              text: "Please enter your name to continue. 😊",
            };

            // Send the messages sequentially
            if (user.name) {
              await sendMessage(userPhone, message1);
              if (user.subscriptionPaymentStatus) {
                return await sendMessage(userPhone, message2);
              }
              return;
            } else {
              state.username = "taking_name";
              await state.save();
              return await sendMessage(userPhone, message3);
            }
          } else if (buttonId === "edit_date") {
            const state = await State.findOne({ userPhone });
            const dateprompt = {
              text: "⏰ Please enter the date you'd like to edit (format: YYYY-MM-DD).",
            };
            state.useredit = "awaiting_edit_date";
            await state.save();
            return await sendMessage(userPhone, dateprompt);
          } else if (buttonId === "edit_address_existing") {
            const state = await State.findOne({ userPhone });
            const prompt = {
              text: "🏠 Please enter your new address below.",
            };

            state.useredit = "awaiting_edit_address_existing";
            await state.save();
            return await sendMessage(userPhone, prompt);
          } else if (buttonId === "edit_quantity") {
            const message1 = {
              text: "🔢 Please enter the quantity you'd like to purchase.",
            };

            await sendMessage(userPhone, message1);
            state.useredit = "awaiting_edit_quantity";
            return await state.save();
          } else if (buttonId === "cancel_subscription") {
            const msg = {
              text: "⚠️ Are you sure you want to confirm your cancellation?",
            };

            await sendMessage(userPhone, msg);
            const message = {
              text: "❗ Are you sure you want to cancel your subscription?",
              buttons: [
                { id: "yes_cancel", title: "Yes, Cancel" },
                { id: "no_cancel", title: "No, Keep It" },
              ],
            };

            return await sendMessage(userPhone, message);
          } else if (buttonId === "old_address") {
            return await handleAddress(userPhone);
          } else if (buttonId === "new_address") {
            const state = await State.findOne({ userPhone });
            if (state.planType.includes("plan")) {
              const message = {
                text: "🏠 Please provide your address to complete your subscription.",
              };

              await sendMessage(userPhone, message);
            } else {
              const message = {
                text: "📍 Kindly provide your address to proceed.",
              };

              await sendMessage(userPhone, message);
            }

            state.useradd = "awaiting_address";
            return await state.save();
          } else if (buttonId === "ghee_prep") {
            const msg = {
              text: "Videos",
            };
            await sendMessage(userPhone, msg);
            const buttonMessage = {
              text: "✨ Click below to continue and get started!",
              buttons: [
                {
                  id: "help",
                  title: "Continue",
                },
              ],
            };

            return await sendMessage(userPhone, buttonMessage);
          } else if (buttonId === "faq") {
            const msg1 = {
              text: "faq",
            };

            await sendMessage(userPhone, msg1);
            const buttonMessage = {
              text: "✨ Click below to continue and get started!",
              buttons: [
                {
                  id: "help",
                  title: "Continue",
                },
              ],
            };
            return await sendMessage(userPhone, buttonMessage);
          } else if (buttonId === "contact") {
            const msg2 = {
              text: "contact",
            };
            await sendMessage(userPhone, msg2);
            const buttonMessage = {
              text: "✨ Click below to continue and get started!",
              buttons: [
                {
                  id: "help",
                  title: "Continue",
                },
              ],
            };
            return await sendMessage(userPhone, buttonMessage);
          } else if (buttonId === "A2_ghee" || buttonId === "buffalo") {
            return await buttonHandlers.handleBuyGheeQuantity(
              userPhone,
              buttonId
            );
          } else if (buttonId.includes("_planA2")) {
            let amount = 1;

            if (buttonId === "small_planA2") amount *= 500;
            else if (buttonId === "medium_planA2") amount *= 1000;
            else if (buttonId === "large_planA2") amount *= 2000;
            else if (buttonId === "custom_planA2") {
              const state = await State.findOne({ userPhone });
              if (state) {
                state.userState = "awaiting_custom_amount_plan_A2";
                await state.save();
              }

              const message = {
                text: "💰 Enter the amount you'd like to order (must be divisible by 500).",
              };

              return await sendMessage(userPhone, message);
            }
            const user = await User.findOne({ phone: userPhone });
            const state = await State.findOne({ userPhone });

            state.userAmount = amount;
            state.planType = "plan_A2";
            await state.save();
            if (user.address) {
              const buttonMessage = {
                text: `📍 Do you want to continue with the address: ${user.address}?`,
                buttons: [
                  {
                    id: "old_address",
                    title: "old address",
                  },
                  {
                    id: "new_address",
                    title: "New Address",
                  },
                ],
              };

              return await sendMessage(userPhone, buttonMessage);
            }
            const message = {
              text: "📦 To complete your subscription, please provide your address.",
            };

            if (state) {
              state.useradd = "awaiting_address";
              await state.save();
            }
            return await sendMessage(userPhone, message);
          } else if (buttonId.includes("_A2")) {
            let amount = 350;
            if (buttonId === "small_A2") amount *= 500;
            else if (buttonId === "medium_A2") amount *= 1000;
            else if (buttonId === "large_A2") amount *= 2000;
            else if (buttonId === "plan_A2") {
              return await buttonHandlers.handleBuyGheePlanQuantity(
                userPhone,
                buttonId
              );
            } else if (buttonId === "custom_A2") {
              const state = await State.findOne({ userPhone });
              if (state) {
                state.userState = "awaiting_custom_amount_A2";
                await state.save();
              }

              const message = {
                text: "💸 Enter the amount you'd like to order (must be divisible by 500).",
              };

              return await sendMessage(userPhone, message);
            }
            const user = await User.findOne({ phone: userPhone });
            const state = await State.findOne({ userPhone });

            state.userAmount = amount;
            state.planType = "A2";
            await state.save();
            if (user.address) {
              const buttonMessage = {
                text: `📍 Do you want to continue with the address: ${user.address}?`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Old address",
                  },
                  {
                    id: "new_address",
                    title: "New Address",
                  },
                ],
              };

              return await sendMessage(userPhone, buttonMessage);
            }
            const message = {
              text: "Please provide your address.",
            };
            state.useradd = "awaiting_address";
            await state.save();

            return await sendMessage(userPhone, message);
          } else if (buttonId.includes("_planbuffalo")) {
            let amount = 1;

            if (buttonId === "small_planbuffalo") amount *= 500;
            else if (buttonId === "medium_planbuffalo") amount *= 1000;
            else if (buttonId === "large_planbuffalo") amount *= 2000;
            else if (buttonId === "custom_planbuffalo") {
              const state = await State.findOne({ userPhone });
              if (state) {
                state.userState = "awaiting_custom_amount_plan_buffalo";
                await state.save();
              }

              const message = {
                text: "💰 Please enter the amount you'd like to order (must be divisible by 500).",
              };

              return await sendMessage(userPhone, message);
            }
            const user = await User.findOne({ phone: userPhone });
            const state = await State.findOne({ userPhone });

            state.userAmount = amount;
            state.planType = "plan_buffalo";
            await state.save();
            if (user.address) {
              const buttonMessage = {
                text: `📍 Do you want to continue with this address: ${user.address}?`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Old Address",
                  },
                  {
                    id: "new_address",
                    title: "New Address",
                  },
                ],
              };

              return await sendMessage(userPhone, buttonMessage);
            }
            const message = {
              text: "📍 To complete your subscription, kindly provide your address.",
            };

            if (state) {
              state.useradd = "awaiting_address";
              await state.save();
            }
            return await sendMessage(userPhone, message);
          } else if (buttonId.includes("_buffalo")) {
            let amount = 400;
            if (buttonId === "small_buffalo") amount *= 500;
            else if (buttonId === "medium_buffalo") amount *= 1000;
            else if (buttonId === "large_buffalo") amount *= 2000;
            else if (buttonId === "plan_buffalo") {
              return await buttonHandlers.handleBuyGheePlanQuantity(
                userPhone,
                buttonId
              );
            } else if (buttonId == "custom_buffalo") {
              const state = await State.findOne({ userPhone });
              if (state) {
                state.userState = "awaiting_custom_amount_buffalo";
                await state.save();
              }

              const message = {
                text: "💸 Please enter the amount you'd like to order (must be divisible by 500).",
              };

              return await sendMessage(userPhone, message);
            }
            const user = await User.findOne({ phone: userPhone });
            const state = await State.findOne({ userPhone });

            state.userAmount = amount;
            state.planType = "buffalo";
            await state.save();
            if (user.address) {
              const buttonMessage = {
                text: `📍 Would you like to continue with the address: ${user.address}?`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Old Address",
                  },
                  {
                    id: "new_address",
                    title: "New Address",
                  },
                ],
              };

              return await sendMessage(userPhone, buttonMessage);
            }
            const message = {
              text: "🏠 Please provide your address to proceed.",
            };

            if (state) {
              state.useradd = "awaiting_address";
              await state.save();
            }
            return await sendMessage(userPhone, message);
          } else if (buttonId.includes("_address")) {
            const state = await State.findOne({ userPhone });
            if (buttonId === "edit_address") {
              state.useradd = "awaiting_edit_address";
              await state.save();
              const message = {
                text: "📍 Kindly provide your new address to continue.",
              };

              return await sendMessage(userPhone, message);
            } else if (buttonId === "same_address") {
              state.useradd = "awaiting_same_address";
              await state.save();
              const message = {
                text: "📍 Continuing with the same address. Please hold on...",
              };

              await sendMessage(userPhone, message);
              return await handleAddressInput("same address", userPhone);
            }
          } else if (buttonId === "buy_ghee") {
            return await buttonHandlers.handleBuyGhee(userPhone);
          } else if (buttonId === "customer_support") {
            // Call the handler for "Customer Support"
            return await buttonHandlers.handleCustomerSupport(userPhone);
          } else if (buttonId === "know_about_us") {
            // Call the handler for "B2B"
            return await buttonHandlers.handleknowaboutus(userPhone);
          } else if (buttonId === "view_plans") {
            const user = await User.findOne({ phone: userPhone });
            deliveryDate = user.deliveryDate;

            const msg = {
              text: `📦 Your current plan is: ${
                user.subscriptionType
              } Ghee with a quantity of ${user.subscriptionQuantity}.\n
            Started on: ${user.subscriptionStartDate.toDateString()}\n
            Scheduled delivery: ${deliveryDate.toDateString()}\n
            Total amount: $${user.subscriptionAmount}`,
              buttons: [
                { id: "edit_date", title: "Edit Date" },
                { id: "edit_quantity", title: "Edit Qty" },
                { id: "edit_address_existing", title: "Edit Address" },
              ],
            };

            await sendMessage(userPhone, msg);
            const msg2 = {
              text: "❌ Do you want to cancel your subscription?\nPlease confirm below:",
              buttons: [{ id: "cancel_subscription", title: "Cancel" }],
            };

            return await sendMessage(userPhone, msg2);
          } else if (buttonId === "yes_cancel") {
            state.useredit = "awaiting_cancel_subscription";
            await state.save();
            const msg = {
              text: "❌ To cancel your subscription, simply reply with 'cancel'.",
            };

            return await sendMessage(userPhone, msg);
          } else if (buttonId === "no_cancel") {
            const msg = {
              text: "🚫 Subscription not cancelled. Type 'Hi' to get assistance!",
            };

            return await sendMessage(userPhone, msg);
          }
        }

        return; // Acknowledge receipt of the button interaction
      } else {
        // Default message if no recognized text
        resetUserState(userPhone);
        return await sendMessage(userPhone, {
          text: "💬 Need assistance? Click below for help!",
          buttons: [{ id: "help", title: "Get Help" }],
        });
      }
    }

    return;
  } catch (error) {
    return res.sendStatus(500); // Internal server error if something goes wrong
  }
};

async function handleAddress(userPhone) {
  const state = await State.findOne({ userPhone });
  if (state.planType === "plan_buffalo" || state.planType === "plan_A2") {
    message = {
      text: "🎉 Thank you for providing your address! Now, let us know the day (1-31) you'd like to receive your monthly Ghee delivery. 📅",
    };

    // Update user state to await subscription date

    state.useradd = "awaiting_subscription_date";
    await state.save();
    return await sendMessage(userPhone, message);
  } else {
    message = {
      text: "🎉 Thank you for providing your address! We’ll process your order and deliver it ASAP. 🚚",
    };
    await sendMessage(userPhone, message);
    if (state.planType === "A2")
      await createPayment_A2(userPhone, state.userAmount);
    if (state.planType === "buffalo")
      await createPayment_buffalo(userPhone, state.userAmount);
    state.planType = null;
    return await state.save();
  }
}

// Function to process custom amount input from the user
async function handleCustomAmountInput_A2(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number

  amount *= 350;
  if (isNaN(amount) || amount <= 0 || amount % 500 != 0) {
    // Send error message if the input is not a valid positive number
    const errorMessage = {
      text: "⚠️ Please enter a valid amount. Ensure it’s a number.",
    };
    return await sendMessage(userPhone, errorMessage);
  }
  const user = await User.findOne({ phone: userPhone });
  const state = await State.findOne({ userPhone });
  state.userState = null;
  state.userAmount = amount;
  state.planType = "A2";
  await state.save();
  if (user.address) {
    const buttonMessage = {
      text: `📍 Would you like to continue with your current address: ${user.address}?`,
      buttons: [
        {
          id: "old_address",
          title: "Same Address",
        },
        {
          id: "new_address",
          title: "New Address",
        },
      ],
    };
    return await sendMessage(userPhone, buttonMessage);
  }
  const message = {
    text: "📍 Please provide your address for delivery.",
  };

  if (state) {
    state.useradd = "awaiting_address";
    await state.save();
  }
  return await sendMessage(userPhone, message);
}

async function handleCustomAmountInput_buffalo(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  amount *= 400;
  if (isNaN(amount) || amount <= 0 || amount % 500 != 0) {
    // Send error message if the input is not a valid positive number
    const errorMessage = {
      text: "⚠️ Please enter a valid amount (divisible by 500).",
    };
    return await sendMessage(userPhone, errorMessage);
  }
  const user = await User.findOne({ phone: userPhone });
  const state = await State.findOne({ userPhone });
  state.userState = null;
  state.userAmount = amount;

  state.planType = "buffalo";
  await state.save();
  if (user.address) {
    const buttonMessage = {
      text: `📍 Want to continue with your current address: ${user.address}?`,
      buttons: [
        {
          id: "old_address",
          title: "Same Address",
        },
        {
          id: "new_address",
          title: "New Address",
        },
      ],
    };
    return await sendMessage(userPhone, buttonMessage);
  }
  const message = {
    text: "📬 Please provide your delivery address for subscription.",
  };
  if (state) {
    state.useradd = "awaiting_address";
    await state.save();
  }
  return await sendMessage(userPhone, message);
}

// Custom amount input handler for Buffalo Ghee
async function handleCustomAmountInput_plan_buffalo(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  amount *= 1;

  if (isNaN(amount) || amount <= 0 || amount % 500 !== 0) {
    const errorMessage = {
      text: "⚠️ Please enter a valid amount (divisible by 500).",
    };
    return await sendMessage(userPhone, errorMessage);
  }
  const user = await User.findOne({ phone: userPhone });
  const state = await State.findOne({ userPhone });
  state.userState = null;
  state.userAmount = amount;

  state.planType = "plan_buffalo";
  await state.save();
  if (user.address) {
    const buttonMessage = {
      text: `📍 Want to continue with your current address: ${user.address}?`,
      buttons: [
        {
          id: "old_address",
          title: "Same Address",
        },
        {
          id: "new_address",
          title: "New Address",
        },
      ],
    };
    return await sendMessage(userPhone, buttonMessage);
  }
  const message = {
    text: "📬 Please provide your address for subscription.",
  };
  if (state) {
    state.useradd = "awaiting_address";
    await state.save();
  }
  return await sendMessage(userPhone, message);
}

// Custom amount input handler for A2 Cow Ghee
async function handleCustomAmountInput_plan_A2(messageText, userPhone) {
  let amount = parseInt(messageText); // Convert input to a number
  amount *= 1;

  if (isNaN(amount) || amount <= 0 || amount % 500 !== 0) {
    const errorMessage = {
      text: "⚠️ Please enter a valid amount (divisible by 500).",
    };
    return await sendMessage(userPhone, errorMessage);
  }
  const user = await User.findOne({ phone: userPhone });
  const state = await State.findOne({ userPhone });
  state.userState = null;
  state.userAmount = amount;

  state.planType = "plan_A2";
  await state.save();
  if (user.address) {
    const buttonMessage = {
      text: `📍 Want to continue with your current address: ${user.address}?`,
      buttons: [
        {
          id: "old_address",
          title: "Same Address",
        },
        {
          id: "new_address",
          title: "New Address",
        },
      ],
    };
    return await sendMessage(userPhone, buttonMessage);
  }
  const message = {
    text: "📬 Please provide your address for subscription.",
  };
  if (state) {
    state.useradd = "awaiting_address";
    await state.save();
  }
  return await sendMessage(userPhone, message);
}

// Initialize Razorpay with your API credentials
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createPayment_A2(userPhone, amount) {
  const description = "Purchase of Ghee";
  try {
    const paymentLink = await generatePaymentLinkWithDivision(
      amount,
      userPhone,
      description
    );

    const message = {
      text: `Complete your purchase here 🛒: ${paymentLink} 💳`,
    };

    const state = await State.findOne({ userPhone });
    state.userState = null;
    state.useradd = null;
    state.planType = null;
    state.useredit = null;
    state.username = null;
    state.userAmount = null;
    await state.save();

    return await sendMessage(userPhone, message);
  } catch (error) {
    return;
  }
}

async function createPayment_buffalo(userPhone, amount) {
  const description = "Purchase of Ghee";
  try {
    const paymentLink = await generatePaymentLinkWithDivision(
      amount,
      userPhone,
      description
    );
    const message = {
      text: `✨ Please complete your purchase here: ${paymentLink} 🛒\nThank you for choosing us! 💖`,
    };

    const state = await State.findOne({ userPhone });
    state.userState = null;
    state.useradd = null;
    state.planType = null;
    state.useredit = null;
    state.username = null;
    state.userAmount = null;
    await state.save();

    return await sendMessage(userPhone, message);
  } catch (error) {
    return;
  }
}

async function createSubscriptionA2(userPhone, amountMultiplier) {
  const description = "Monthly Subscription of A2 Cow Ghee";

  try {
    // Create the subscription using Razorpay
    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: process.env.PLAN_ID_A2,
      customer_notify: 1,
      total_count: 12, // Example: 12-month subscription
      quantity: amountMultiplier / 500,
      notes: {
        phone: userPhone,
        description: description,
        amount: (350 * amountMultiplier) / 500,
      },
    });

    // Update the user record with subscription details
    const user = await User.findOneAndUpdate(
      { phone: userPhone },
      { planId: process.env.PLAN_ID_A2 },
      { new: true }
    );

    if (user) {
      user.subscription = true;
      user.subscriptionQuantity = subscription.quantity;
      user.subscriptionType = "A2 Cow"; //future problem may arise coz of space
      user.subscriptionAmount = subscription.notes.amount;
    }

    const reminderDate = new Date(user.deliveryDate);
    reminderDate.setMonth(reminderDate.getMonth() + 1); // Advance by one month
    reminderDate.setDate(reminderDate.getDate() - 7);

    // Save the calculated reminder date
    user.nextReminderDate = reminderDate;
    await user.save();

    // Send subscription confirmation message to the user
    const message = {
      text: `You have now subscribed to Our Monthly Plan of A2 Cow Ghee. 🎉\n\nYour subscription will start on ${user.subscriptionStartDate.toDateString()} and will be delivered to the address: ${
        user.address
      } 📦\n\nYour first delivery is expected on or around ${user.deliveryDate.toDateString()}.\n\nPlease complete your payment here to activate: ${
        subscription.short_url
      } 💳`,
    };

    await sendMessage(userPhone, message);

    const state = await State.findOne({ userPhone });
    state.userState = null;
    state.useradd = null;
    state.planType = null;
    state.useredit = null;
    state.username = null;
    state.userAmount = null;
    await state.save();

    // Notify the admin of subscription and payment link creation
    const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER"; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Subscription created for ${userPhone}. Payment link: ${subscription.short_url}. Delivery in 4-5 days.`,
    };

    return await sendMessage(adminPhone, adminMessage);
  } catch (error) {
    // Send failure message to user
    const errorMessage = {
      text: "Failed to create subscription. Please try again later.",
    };
    await sendMessage(userPhone, errorMessage);

    // Notify the admin of subscription creation failure
    const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER"; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Alert: Subscription creation failed for ${userPhone}. Error: ${
        error.response ? error.response.data.description : error.message
      }`,
    };
    return await sendMessage(adminPhone, adminMessage);
  }
}

async function createSubscriptionBuffalo(userPhone, amountMultiplier) {
  const description = "Monthly Subscription of Buffalo Ghee";

  try {
    // Create the subscription using Razorpay
    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: process.env.PLAN_ID_BUFFALO,
      customer_notify: 1, // This will still notify the customer (default behavior)
      total_count: 12, // Example: 12-month subscription
      quantity: amountMultiplier / 500,
      notes: {
        phone: userPhone,
        description: description,
        amount: (400 * amountMultiplier) / 500,
      },
    });

    // Update the user record with subscription details
    const user = await User.findOneAndUpdate(
      { phone: userPhone },
      { planId: process.env.PLAN_ID_BUFFALO },
      { new: true }
    );

    if (user) {
      user.subscription = true;
      user.subscriptionQuantity = subscription.quantity;
      user.subscriptionType = "Buffalo";
      user.subscriptionAmount = subscription.notes.amount;
    }

    const reminderDate = new Date(user.deliveryDate);
    reminderDate.setMonth(reminderDate.getMonth() + 1); // Advance by one month
    reminderDate.setDate(reminderDate.getDate() - 7); // Set to 7 days before the next cycle // Set reminder 7 days before next cycle

    // Save the calculated reminder date
    user.nextReminderDate = reminderDate;
    await user.save();

    // Send subscription confirmation message to the user
    const message = {
      text: `🎉 You’ve successfully subscribed to our Monthly Plan of Buffalo Ghee! 🎉\n\nYour subscription starts on ${user.subscriptionStartDate.toDateString()}.\n\nYour Ghee will be delivered to: ${
        user.address
      } on or around ${user.deliveryDate.toDateString()}.\n\nPlease complete your payment here to activate: ${
        subscription.short_url
      }\n\nThank you for choosing us! 🙏`,
    };

    await sendMessage(userPhone, message);

    const state = await State.findOne({ userPhone });
    state.userState = null;
    state.useradd = null;
    state.planType = null;
    state.useredit = null;
    state.username = null;
    state.userAmount = null;
    await state.save();

    // Notify the admin of subscription and payment link creation
    const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER"; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Subscription created for ${userPhone}. Payment link: ${subscription.short_url}. Subscription ID: ${subscription.id}`,
    };
    return await sendMessage(adminPhone, adminMessage);
  } catch (error) {
    // Send failure message to user
    const errorMessage = {
      text: "Failed to create subscription. Please try again later.",
    };
    await sendMessage(userPhone, errorMessage);

    // Notify the admin of subscription creation failure
    const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER"; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Alert: Subscription creation failed for ${userPhone}. Error: ${
        error.response ? error.response.data.description : error.message
      }`,
    };
    return await sendMessage(adminPhone, adminMessage);
  }
}

// Handle address input
async function handleAddressInput(messageText, userPhone) {
  const user = await User.findOne({ phone: userPhone });
  const state = await State.findOne({ userPhone });
  if (
    state.useradd === "awaiting_address" ||
    state.useradd === "awaiting_edit_address"
  ) {
    // const user = await User.findOne({ phone: userPhone });

    if (user) {
      user.address = messageText;
      await user.save();
    }
  }

  if (state.useradd === "awaiting_address") {
    state.useradd = null;
    await state.save();
    const rewriteAddress = {
      text: `📍 Want to continue with your address: ${user.address}?\n\nOr would you like to edit your address? ✏️`,
      buttons: [
        {
          id: "edit_address",
          title: "Edit Address",
        },
        {
          id: "same_address",
          title: "Same Address",
        },
      ],
    };

    return await sendMessage(userPhone, rewriteAddress);
  }

  if (
    state.useradd === "awaiting_same_address" ||
    state.useradd === "awaiting_edit_address"
  ) {
    let message;

    if (state.planType === "plan_buffalo" || state.planType === "plan_A2") {
      message = {
        text: `Thank you for providing your address! 🙏\n\nNow, please let us know the day (1-31) you'd like to have your order delivered. 📅`
      };

      // Update user state to await subscription date

      state.useradd = "awaiting_subscription_date";
      await state.save();
      return await sendMessage(userPhone, message);
    } else {
      state.useradd = null;
      message = {
        text: `Thank you for providing your address! 🙏\n\nWe will deliver your order ASAP! 🚚💨`
      };
      await sendMessage(userPhone, message);
      if (state.planType === "A2")
        await createPayment_A2(userPhone, state.userAmount);
      if (state.planType === "buffalo")
        await createPayment_buffalo(userPhone, state.userAmount);
      state.planType = null;
      return await state.save();
    }
  }
  return;
}

// Handle subscription date input
async function handleSubscriptionDateInput(messageText, userPhone) {
  const dayOfMonth = parseInt(messageText, 10);

  // Validate that the input is a valid day of the month (1-31)
  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    const errorMessage = {
      text: "Please enter a valid day of the month (e.g., 1-31).",
    };
    return await sendMessage(userPhone, errorMessage);
  }

  // Find the user in the database
  const user = await User.findOne({ phone: userPhone });
  const state = await State.findOne({ userPhone });
  state.useradd = null;
  if (user) {
    // Determine the next delivery date based on the entered day
    const today = new Date();
    let deliveryDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      dayOfMonth
    );

    // If the chosen day has already passed this month, set delivery to next month
    if (deliveryDate < today) {
      deliveryDate.setMonth(today.getMonth() + 1);
    }

    const subscriptionDate = new Date();

    // Save the user's preferred day and the calculated first delivery date
    user.deliveryDate = deliveryDate;
    user.subscriptionStartDate = subscriptionDate;
    await user.save();
  }

  // Send confirmation message to the user
  const message = {
    text: `Your subscription deliveries will begin on ${user.subscriptionStartDate.toDateString()}.\n\nFrom then on, deliveries will be made on the ${dayOfMonth} of each month. 📅\n\nPlease complete your payment to activate your subscription. 💳`
  };
  await sendMessage(userPhone, message);

  // Create subscription after collecting all required info
  if (state.planType === "plan_A2") {
    await createSubscriptionA2(userPhone, state.userAmount);
  } else if (state.planType === "plan_buffalo") {
    await createSubscriptionBuffalo(userPhone, state.userAmount);
  }
  state.planType = null;
  return await state.save();
}