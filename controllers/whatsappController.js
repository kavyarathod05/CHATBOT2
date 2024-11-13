const { sendMessage } = require("../utils/whatsappAPI");
const User = require("../models/User"); // Adjust the path if necessar
const buttonHandlers = require("../handlers/buttonHandlers"); // Import button handlers
const { generatePaymentLinkWithDivision } = require("../razorpay/razorpay.js");
const Razorpay = require("razorpay");
const cron = require('node-cron');
const axios = require('axios');

const userStates = {};
const useradd = {};
let userAmount;
const planType = {};
const useredit = {};

exports.receiveMessage = async (req, res) => {
  // Handle Razorpay webhooks
  // if (req.body.event === 'subscription.charged') {
  //   const subscriptionId = req.body.payload.subscription.entity.id;

  //   // Find the user by subscription ID
  //   const user = await User.findOne({ subscriptionId });
  //   if (user) {
  //     const successMessage = {
  //       text: `Thank you! Your subscription payment for A2 Cow Ghee has been successfully processed. Your next delivery is on schedule!`,
  //     };
  //     await sendMessage(user.phone, successMessage);
  //   }
  //   return res.sendStatus(200);
  // }

  // if (req.body.event === 'subscription.charge_failed') {
  //   const subscriptionId = req.body.payload.subscription.entity.id;

  //   // Find the user by subscription ID
  //   const user = await User.findOne({ subscriptionId });
  //   if (user) {
  //     const reminderMessage = {
  //       text: `Your subscription payment for A2 Cow Ghee failed due to insufficient balance. Please ensure you have enough funds in your account for the next attempt.`,
  //     };
  //     await sendMessage(user.phone, reminderMessage);
  //   }
  //   return res.sendStatus(200);
  // }
  try {
    // Safely access entry and changes data
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;

    // Check if the request contains 'messages' (incoming message data)
    const messages = value && value.messages && value.messages[0];
    if (messages) {
      const userPhone = messages.from; // Phone number of the sender
      const messageText = messages.text ? messages.text.body.toLowerCase() : ""; // Safely access message text

      // Check if the user already exists in the database
      let user = await User.findOne({ phone: userPhone });

      // If the user doesn't exist, create a new one
      if (!user) {
        user = new User({
          phone: userPhone, // Save the phone number
        });
        await user.save();
        console.log(`New user added: ${userPhone}`);
      }

      if (userStates[userPhone] === "awaiting_custom_amount_A2") {
        console.log("cow");

        await handleCustomAmountInput_A2(messageText, userPhone);
        userStates[userPhone] = "";
        return res.sendStatus(200);
      } else if (userStates[userPhone] === "awaiting_custom_amount_buffalo") {
        console.log("buffalo");
        await handleCustomAmountInput_buffalo(messageText, userPhone);
        userStates[userPhone] = "";
        return res.sendStatus(200);
      } else if (
        userStates[userPhone] === "awaiting_custom_amount_plan_buffalo"
      ) {
        console.log("buffalo");
        await handleCustomAmountInput_plan_buffalo(messageText, userPhone);
        userStates[userPhone] = "";
        return res.sendStatus(200);
      } else if (userStates[userPhone] === "awaiting_custom_amount_plan_A2") {
        console.log("Plan A2");
        await handleCustomAmountInput_plan_A2(messageText, userPhone);
        userStates[userPhone] = "";
        return res.sendStatus(200);
      }

      // console.log(useradd[userPhone]);
      console.log(planType);

      if (useradd[userPhone] === "awaiting_address") {
        console.log("cow");
        console.log(messageText);
        await handleAddressInput(messageText, userPhone);
        return res.sendStatus(200);
      } else if (useradd[userPhone] === "awaiting_edit_address") {
        await handleAddressInput(messageText, userPhone);
        return res.sendStatus(200);
      } else if (useradd[userPhone] === "awaiting_subscription_date") {
        console.log("Date Called");
        await handleSubscriptionDateInput(messageText, userPhone);
        delete useradd[userPhone];
        return res.sendStatus(200);
      }

      console.log(useredit[userPhone]);

      if (useredit[userPhone] === "awaiting_edit_date") {
        console.log("editing date");

        const subscriptionDate = new Date(messageText);

        // Validate the date format
        if (isNaN(subscriptionDate.getTime())) {
          const errorMessage = {
            text: "Please enter a valid date (e.g., YYYY-MM-DD).",
          };
          await sendMessage(userPhone, errorMessage);
          return; // Return here to stop further processing if date is invalid
        }

        const user = await User.findOne({ phone: userPhone });
        console.log(user.subscriptionId);

        if (user) {
          // Update the date in your database
          user.subscriptionStartDate = subscriptionDate;
          await user.save();

          try {
            // Step 1: Cancel the old subscription if it exists
            if (user.subscriptionId) {
              await razorpayInstance.subscriptions.cancel(user.subscriptionId);
              console.log(
                `Old subscription (${user.subscriptionId}) cancelled successfully.`
              );
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
              text: `Your subscription has been updated successfully! The new start date is ${subscriptionDate.toDateString()}. Please complete your payment here: ${newSubscription.short_url
                }`,
            };
            await sendMessage(userPhone, message);
          } catch (error) {
            console.error("Error updating subscription:", error);
            const errorMessage = {
              text: "Failed to update the subscription. Please try again later.",
            };
            await sendMessage(userPhone, errorMessage);
          }

          return; // Ensure the function stops after processing
        } else {
          const errorMessage = {
            text: "No user found with this phone number.",
          };
          await sendMessage(userPhone, errorMessage);
          return; // Return if no user is found
        }
      }
      if (useredit[userPhone] === "awaiting_edit_address_existing") {
        console.log("editing address");
        console.log(messageText);

        // Update the user's address
        const user = await User.findOneAndUpdate(
          { phone: userPhone }, // Filter: find user by phone number
          { address: messageText }, // Update: set the new address value
          { new: true } // Option to return the updated user document
        );

        if (user) {
          const s = {
            text: "Your address has been updated successfully!"
          };
          await sendMessage(userPhone, s);
        } else {
          const errorMessage = {
            text: "There was an issue updating your address. Please try again.",
          };
          await sendMessage(userPhone, errorMessage);
        }

        return;
      }
      // if (useredit[userPhone] === "awaiting_edit_address") {
      //   console.log("editing address");
      //   console.log(messageText);

      //   // Assuming you want to change the quantity in the Razorpay subscription
      //   // First, get the current user's subscription ID
      //   const user = await User.findOne({ phone: userPhone });

      //   if (user && user.subscriptionId) {
      //     try {
      //       // Cancel the existing subscription in Razorpay
      //       const cancelSubscriptionResponse =
      //         await razorpayInstance.subscriptions.cancel(user.subscriptionId);
      //       console.log(
      //         "Subscription canceled successfully:",
      //         cancelSubscriptionResponse
      //       );

      //       // Create a new subscription with the updated quantity
      //       const updatedQuantity = 2; // Example: updated quantity based on user's input or logic
      //       const subscription = await razorpayInstance.subscriptions.create({
      //         plan_id: user.planId, // Assuming you stored the planId in the user's record
      //         customer_notify: 1,
      //         total_count: 12, // Example: 12-month subscription
      //         quantity: updatedQuantity,
      //         notes: {
      //           phone: userPhone,
      //           description: "Updated subscription with new quantity.",
      //         },
      //       });

      //       // Update the user with the new subscription ID and other details
      //       await User.findOneAndUpdate(
      //         { phone: userPhone },
      //         {
      //           subscriptionId: subscription.id,
      //           subscriptionStartDate: new Date(), // Set the new subscription start date if needed
      //         },
      //         { new: true }
      //       );

      //       // Send the confirmation message
      //       const message = {
      //         text: `Your subscription has been updated successfully. Your new subscription will start with ${updatedQuantity} items. Please complete your payment here to activate: ${subscription.short_url}`,
      //       };
      //       await sendMessage(userPhone, message);
      //     } catch (error) {
      //       console.error("Error processing subscription update:", error);
      //       const errorMessage = {
      //         text: "Failed to update the subscription. Please try again later.",
      //       };
      //       await sendMessage(userPhone, errorMessage);
      //     }
      //   } else {
      //     const errorMessage = {
      //       text: "No active subscription found. Please try again.",
      //     };
      //     await sendMessage(userPhone, errorMessage);
      //   }

      //   return;
      // }
      if (useredit[userPhone] === "awaiting_edit_quantity") {
        useredit[userPhone] = ""
        console.log("editing quantitty");
        const newQuantity = parseInt(messageText, 10);

        // Validate the quantity format (must be a positive integer)
        if (isNaN(newQuantity) || newQuantity <= 0) {
          const errorMessage = {
            text: "Please enter a valid quantity in ml and must be divisible by 500",
          };
          await sendMessage(userPhone, errorMessage);
        }
        const user = await User.findOneAndUpdate(
          { phone: userPhone }, // Filter: find user by phone number
          { quantity: newQuantity }, // Update: set the new address value
          { new: true } // Option to return the updated user document
        );
        //   const user = await User.findOne({ phone: userPhone });
        console.log(user.subscriptionId);

        if (user) {
          // Update the date in your database
          user.userOrderQuantity = newQuantity;
          await user.save();
          const subscriptionDate = user.subscriptionStartDate;

          try {
            // Step 1: Cancel the old subscription if it exists
            if (user.subscriptionId) {
              await razorpayInstance.subscriptions.cancel(user.subscriptionId);
              console.log(
                `Old subscription (${user.subscriptionId}) cancelled successfully`
              );
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
              text: `Your subscription has been updated successfully! The new start date is ${subscriptionDate.toDateString()}. Please complete your payment here: ${newSubscription.short_url
                }`,
            };
            await sendMessage(userPhone, message);
          } catch (error) {
            console.error("Error updating quantity:", error);
            const errorMessage = {
              text: "Failed to update the quantity. Please try again later.",
            };
            await sendMessage(userPhone, errorMessage);
          }

          return; // Ensure the function stops after processing
        } else {
          const errorMessage = {
            text: "No user found with this phone number.",
          };
          await sendMessage(userPhone, errorMessage);
          return; // Return if no user is found
        }
      }
      if (useredit[userPhone] === "awaiting_cancel_subscription") {
        useredit[userPhone] = ""; // Clear the user status

        console.log("Cancelling subscription...");

        try {
          const user = await User.findOne({ phone: userPhone });

          if (!user) {
            console.log(`User with phone ${userPhone} not found.`);
            return;
          }



          if (user.subscriptionId) {
            // Attempt to cancel the subscription using Razorpay API
            try {
              await razorpayInstance.subscriptions.cancel(user.subscriptionId);
              console.log(`Your subscription (${user.subscriptionId}) cancelled successfully.`);
              const msg = {
                prm: "your subscription cancelled successfully"
              }
              sendMessage(userPhone, msg);
              user.subscription = false;
              user.subscriptionId = "";
              user.planId = "";
              await user.save();
              console.log(user);
              return;
            } catch (error) {
              console.error(`Failed to cancel subscription: ${error.message}`);
            }
          } else {
            console.log("User does not have an active subscription.");
          }
        } catch (error) {
          console.error(`Error retrieving user: ${error.message}`);
        }

        return;
      }


      // Handle different types of incoming messages
      if (
        messageText == "hi" ||
        messageText == "hello" ||
        messageText == "help"
      ) {
        userStates[userPhone] = "";
        useradd[userPhone] = "";
        userAmount = "";
        planType[userPhone] = "";
        useredit[userPhone] = "";
        // Send a welcome message
        const welcomeText =
          "Hi there! Welcome to Nani's Bilona Ghee. How can we assist you today?";
        const imageUrl =
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQXaekK87HoROClCOCn3UAEwvmxcHSOdTKqg&s"; // Replace with your image URL

        const messageData = {
          text: welcomeText,
          media: [
            {
              type: "image",
              url: imageUrl,
            },
          ],
          buttons: [{ id: "help", title: "Need help!!" }],
        };

        await sendMessage(userPhone, messageData);
      } else if (messages.interactive && messages.interactive.button_reply) {
        const buttonId = messages.interactive.button_reply.id; // Button ID the user clicked
        console.log(buttonId);

        if (buttonId) {
          if (buttonId == "help") {
            // Respond with an interactive menu for help
            const message1 = {
              text: "How can we assist you today? Please choose an option below:",
              buttons: [
                { id: "buy_ghee", title: "Buy Our Ghee" },
                { id: "subscription_plans", title: "Customer Support" },
                { id: "contact_support", title: "B2B" },
              ],
            };

            const message2 = {
              text: "Existing Customer?",
              buttons: [{ id: "view_plans", title: "View Your Plans" }],
            };

            // Send the messages sequentially
            await sendMessage(userPhone, message1);
            const user = await User.findOne({ phone: userPhone });
            if (user) {
              if (user.subscription) {
                await sendMessage(userPhone, message2);
              }
            }
          }
          if (buttonId === "edit_date") {
            const dateprompt = {
              text: "Please enter the date to edit in format YYYY-MM-DD",
            };
            useredit[userPhone] = "awaiting_edit_date";
            sendMessage(userPhone, dateprompt);
            return;
          }
          if (buttonId === "edit_address_existing") {
            const prompt = {
              text: "Please enter new address",
            };
            useredit[userPhone] = "awaiting_edit_address_existing";
            await sendMessage(userPhone, prompt);
            return;
          }
          if (buttonId === "edit_quantity") {
            const message1 = {
              text: "enter quantity",
            };
            await sendMessage(userPhone, message1);
            useredit[userPhone] = "awaiting_edit_quantity";
            return;
          }
          if (buttonId === "cancel_subscription") {
            const msg = {
              text: "Confirm Your Cancellation",
            };
            await sendMessage(userPhone, msg);
            const message = {
              text: "do you want to cancel the subscription??",
              buttons: [
                { id: "yes_cancel", title: "cancel subscription" },
                { id: "no_cancel", title: "No" },
              ]
            }
            await sendMessage(userPhone, message);
            return;
          }

          if (buttonId === "old_address") {
            await handleAddress(userPhone);
            return;
          }

          if (buttonId === "new_address") {
            if (planType[userPhone].includes("plan")) {
              const message = {
                text: "Please provide your address for Subscription.",
              };
              await sendMessage(userPhone, message);
            } else {
              const message = {
                text: "Please provide your address.",
              };
              await sendMessage(userPhone, message);
            }
            useradd[userPhone] = "awaiting_address";
            return;
          }


          if (buttonId == "A2_ghee" || buttonId == "buffalo") {
            if (messages.interactive && messages.interactive.button_reply) {
              const buttonId = messages.interactive.button_reply.id; // Button ID the user clicked
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
              userStates[userPhone] = "awaiting_custom_amount_plan_A2";
              const message = {
                text: "Please enter the amount you want to order (should be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return;
            }
            const user = await User.findOne({ phone: userPhone });

            userAmount = amount;
            planType[userPhone] = "plan_A2";
            console.log(user.address);
            if (user.address) {
              const buttonMessage = {
                text: `Want to continue with address : ${user.address}`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Yes Same Address"
                  },
                  {
                    id: "new_address",
                    title: "New Address"
                  }
                ]
              };
              await sendMessage(userPhone, buttonMessage);
              return;
            }
            const message = {
              text: "Please provide your address for Subscription.",
            };
            useradd[userPhone] = "awaiting_address";
            await sendMessage(userPhone, message);
            return;

            // Use the amount multiplier to create the subscription
            // await createSubscriptionA2(userPhone, amount);
          } else if (buttonId.includes("_A2")) {
            console.log("no plan A2");
            let amount = 350;
            if (buttonId == "small_A2") amount *= 500;
            else if (buttonId == "medium_A2") amount *= 1000;
            else if (buttonId == "large_A2") amount *= 2000;
            else if (buttonId == "plan_A2") {
              if (messages.interactive && messages.interactive.button_reply) {
                const buttonId = messages.interactive.button_reply.id; // Button ID the user clicked
                console.log(buttonId);

                return await buttonHandlers.handleBuyGheePlanQuantity(
                  userPhone,
                  buttonId
                );
              }
            } else if (buttonId == "custom_A2") {
              userStates[userPhone] = "awaiting_custom_amount_A2";
              const message = {
                text: "Please enter the amount you want to Order (shoud be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return res.sendStatus(200); // Await custom input
            }
            const user = await User.findOne({ phone: userPhone });

            userAmount = amount;
            planType[userPhone] = "A2";
            console.log(user.address);
            if (user.address) {
              const buttonMessage = {
                text: `Want to continue with address : ${user.address}`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Yes Same Address"
                  },
                  {
                    id: "new_address",
                    title: "New Address"
                  }
                ]
              };
              await sendMessage(userPhone, buttonMessage);
              return;
            }
            const message = {
              text: "Please provide your address.",
            };
            useradd[userPhone] = "awaiting_address";
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
              userStates[userPhone] = "awaiting_custom_amount_plan_buffalo";
              const message = {
                text: "Please enter the amount you want to order (should be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return;
            }
            const user = await User.findOne({ phone: userPhone });

            userAmount = amount;
            planType[userPhone] = "plan_buffalo";
            console.log(user.address);
            if (user.address) {
              const buttonMessage = {
                text: `Want to continue with address : ${user.address}`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Yes Same Address"
                  },
                  {
                    id: "new_address",
                    title: "New Address"
                  }
                ]
              };
              await sendMessage(userPhone, buttonMessage);
              return;
            }
            const message = {
              text: "Please provide your address for Subscription.",
            };
            useradd[userPhone] = "awaiting_address";
            await sendMessage(userPhone, message);
            return;

            // Use the amount multiplier to create the subscription
            // await createSubscriptionBuffalo(userPhone, amount);
          } else if (buttonId.includes("_buffalo")) {
            console.log("no plan buffalo");
            let amount = 400;
            if (buttonId == "small_buffalo") amount *= 500;
            else if (buttonId == "medium_buffalo") amount *= 1000;
            else if (buttonId == "large_buffalo") amount *= 2000;
            else if (buttonId == "plan_buffalo") {
              if (messages.interactive && messages.interactive.button_reply) {
                const buttonId = messages.interactive.button_reply.id; // Button ID the user clicked
                console.log(buttonId);

                return await buttonHandlers.handleBuyGheePlanQuantity(
                  userPhone,
                  buttonId
                );
              }
            } else if (buttonId == "custom_buffalo") {
              userStates[userPhone] = "awaiting_custom_amount_buffalo";
              const message = {
                text: "Please enter the amount you want to Order (shoud be divisible by 500).",
              };
              await sendMessage(userPhone, message);
              return res.sendStatus(200); // Await custom input
            }
            const user = await User.findOne({ phone: userPhone });

            userAmount = amount;
            planType[userPhone] = "buffalo";
            console.log(user.address);
            if (user.address) {
              const buttonMessage = {
                text: `Want to continue with address : ${user.address}`,
                buttons: [
                  {
                    id: "old_address",
                    title: "Yes Same Address"
                  },
                  {
                    id: "new_address",
                    title: "New Address"
                  }
                ]
              };
              await sendMessage(userPhone, buttonMessage);
              return;
            }
            const message = {
              text: "Please provide your address.",
            };
            useradd[userPhone] = "awaiting_address";
            await sendMessage(userPhone, message);
            return;
          }

          if (buttonId.includes("_address")) {
            if (buttonId === "edit_address") {
              useradd[userPhone] = "awaiting_edit_address";
              const message = {
                text: "Please provide your new address",
              };
              await sendMessage(userPhone, message);
              console.log(useradd[userPhone]);
              return;
            } else if (buttonId === "same_address") {
              useradd[userPhone] = "awaiting_same_address";
              const message = {
                text: "Continuing with The same address....",
              };
              await sendMessage(userPhone, message);
              console.log(useradd[userPhone]);
              await handleAddressInput("same address", userPhone);
              return;
            }
            return;
          }

          if (buttonId === "buy_ghee") {
            // Call the handler for "Buy Our Ghee"
            if (messages.interactive && messages.interactive.button_reply) {
              const buttonId = messages.interactive.button_reply.id; // Button ID the user clicked
              console.log(buttonId);

              await buttonHandlers.handleBuyGhee(userPhone, buttonId);
            }
          } else if (buttonId === "customer_support") {
            // Call the handler for "Customer Support"
            await buttonHandlers.handleCustomerSupport(userPhone);
          } else if (buttonId === "b2b") {
            // Call the handler for "B2B"
            await buttonHandlers.handleB2B(userPhone);
          } else if (buttonId === "view_plans") {
            const user = await User.findOne({ phone: userPhone })
            
            const today = new Date();
            let deliveryDate = new Date(today.getFullYear(), today.getMonth(), user.deliveryDay);

            // If the chosen day has already passed this month, set delivery to next month
            if (deliveryDate < today) {
              deliveryDate = nextReminderDate;
            }

            const msg = {
              text: `Your Plan is ${user.subscriptionType} Ghee having Quantity ${user.subscriptionQuantity} which was started on ${user.subscriptionStartDate.toDateString()} and which is scheduled to deliver on or Around ${deliveryDate} and the Amount is ${user.subscriptionAmount} `,
              buttons: [
                { id: "edit_date", title: "edit date" },
                { id: "edit_quantity", title: "edit quantity" },
                { id: "edit_address_existing", title: "edit address" },
              ],
            };
            sendMessage(userPhone, msg);
            const msg2 = {
              text: "do you want to cancel the subscription??",
              buttons: [
                { id: "cancel_subscription", title: "cancel subscription" },
              ]
            }
            await sendMessage(userPhone, msg2);
            return;
          }

          if (buttonId === "yes_cancel") {
            useredit[userPhone] = "awaiting_cancel_subscription";
            const msg = {
              text: "If you want to cancel your subscription. then write 'cancel'.",
            };
            await sendMessage(userPhone, msg);
            return;
          }
          else if (buttonId === "no_cancel") {
            const msg = {
              text: "Not cancelling Your Subscription. Type 'Hi' to get Help!!!",
            };
            await sendMessage(userPhone, msg);
            return;
          }
        }

        return res.sendStatus(200); // Acknowledge receipt of the button interaction
      } else {
        // Default message if no recognized text
        console.log(messages);
        await sendMessage(userPhone, {
          text: "Click if you need any type if help!!",
          buttons: [{ id: "help", title: "Need help!!" }],
        });
      }

      return res.sendStatus(200); // Acknowledge receipt of the message
    }

    res.sendStatus(400); // Bad request, invalid data
  } catch (error) {
    console.error("Error processing the message:", error);
    res.sendStatus(500); // Internal server error if something goes wrong
  }
};

async function handleAddress(userPhone) {
  if (
    planType[userPhone] === "plan_buffalo" ||
    planType[userPhone] === "plan_A2"
  ) {
    message = {
      text: "Thank you for providing your address! Now, let us know the date you'd like to start your subscription (format: YYYY-MM-DD).",
    };

    // Update user state to await subscription date

    useradd[userPhone] = "awaiting_subscription_date";
    await sendMessage(userPhone, message);
    return;
  } else {
    useradd[userPhone] = "";
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
  const user = await User.findOne({ phone: userPhone });

  userAmount = amount;
  planType[userPhone] = "A2";
  console.log(user.address);
  if (user.address) {
    const buttonMessage = {
      text: `Want to continue with address : ${user.address}`,
      buttons: [
        {
          id: "old_address",
          title: "Yes Same Address"
        },
        {
          id: "new_address",
          title: "New Address"
        }
      ]
    };
    await sendMessage(userPhone, buttonMessage);
    return;
  }
  const message = {
    text: "Please provide your address.",
  };
  useradd[userPhone] = "awaiting_address";
  await sendMessage(userPhone, message);
  return;

  // const description = "Custom Amount Purchase of Ghee";

  // try {
  //   // Generate payment link with the custom amount
  //   const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

  //   const message = {
  //     text: Please complete your purchase here: ${paymentLink},
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
  const user = await User.findOne({ phone: userPhone });

  userAmount = amount;
  planType[userPhone] = "buffalo";
  console.log(user.address);
  if (user.address) {
    const buttonMessage = {
      text: `Want to continue with address : ${user.address}`,
      buttons: [
        {
          id: "old_address",
          title: "Yes Same Address"
        },
        {
          id: "new_address",
          title: "New Address"
        }
      ]
    };
    await sendMessage(userPhone, buttonMessage);
    return;
  }
  const message = {
    text: "Please provide your address.",
  };
  useradd[userPhone] = "awaiting_address";
  await sendMessage(userPhone, message);
  return;

  // const description = "Custom Amount Purchase of Ghee";

  // try {
  //   // Generate payment link with the custom amount
  //   const paymentLink = await generatePaymentLinkWithDivision(amount, userPhone, description);

  //   const message = {
  //     text: Please complete your purchase here: ${paymentLink},
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
  const user = await User.findOne({ phone: userPhone });

  userAmount = amount;
  planType[userPhone] = "plan_buffalo";
  console.log(user.address);
  if (user.address) {
    const buttonMessage = {
      text: `Want to continue with address : ${user.address}`,
      buttons: [
        {
          id: "old_address",
          title: "Yes Same Address"
        },
        {
          id: "new_address",
          title: "New Address"
        }
      ]
    };
    await sendMessage(userPhone, buttonMessage);
    return;
  }
  const message = {
    text: "Please provide your address for Subscription.",
  };
  useradd[userPhone] = "awaiting_address";
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
  const user = await User.findOne({ phone: userPhone });

  userAmount = amount;
  planType[userPhone] = "plan_A2";
  console.log(user.address);
  if (user.address) {
    const buttonMessage = {
      text: `Want to continue with address : ${user.address}`,
      buttons: [
        {
          id: "old_address",
          title: "Yes Same Address"
        },
        {
          id: "new_address",
          title: "New Address"
        }
      ]
    };
    await sendMessage(userPhone, buttonMessage);
    return;
  }
  const message = {
    text: "Please provide your address for Subscription.",
  };
  useradd[userPhone] = "awaiting_address";
  await sendMessage(userPhone, message);
  return;

  // Use the custom amount to create the subscription
  // await createSubscriptionA2(userPhone, amount);
}

// Initialize Razorpay with your API credentials
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


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
//       text: You have now subscribed to Our Monthly Plan of Buffalo Ghee. Please complete your payment here to activate: ${subscription.short_url},
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
//       text: You have now subscribed to Our Monthly Plan of A2 Cow Ghee. Please complete your payment here to activate: ${subscription.short_url},
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
    const paymentLink = await generatePaymentLinkWithDivision(
      amount,
      userPhone,
      description
    );

    const message = {
      text: `Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
    return;
  } catch (error) {
    console.error("Error sending payment link:", error);
    res.sendStatus(500);
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
      text: `Please complete your purchase here: ${paymentLink}`,
    };

    await sendMessage(userPhone, message);
    return;
  } catch (error) {
    console.error("Error sending payment link:", error);
    res.sendStatus(500);
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
        amount: 350 * amountMultiplier / 500
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
      user.subscriptionId = subscription.id;
      user.subscriptionQuantity = subscription.quantity;
      user.subscriptionType = "A2 Cow" //future problem may arise coz of space
      user.subscriptionAmount = subscription.notes.amount;
    }

    const reminderDate = new Date(user.deliveryDay);
    reminderDate.setDate(reminderDate.getDate() + 23); // Set reminder 7 days before next cycle

    // Save the calculated reminder date
    user.nextReminderDate = reminderDate;
    await user.save();

    const today = new Date();
    let deliveryDate = new Date(today.getFullYear(), today.getMonth(), user.deliveryDay);

    // If the chosen day has already passed this month, set delivery to next month
    if (deliveryDate < today) {
      deliveryDate.setMonth(today.getMonth() + 1);
    }

    // Send subscription confirmation message to the user
    const message = {
      text: `You have now subscribed to Our Monthly Plan of A2 Cow Ghee. Your subscription will start on ${user.subscriptionStartDate.toDateString()} and will be delivered to the address: ${user.address} on or around ${deliveryDate.toDateString()}. Please complete your payment here to activate: ${subscription.short_url}`,
    };
    await sendMessage(userPhone, message);

    // Notify the admin of subscription and payment link creation
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER'; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Subscription created for ${userPhone}. Payment link: ${subscription.short_url}. Subscription ID: ${subscription.id}`,
    };
    await sendMessage(adminPhone, adminMessage);

    console.log("Subscription created with ID:", subscription.id);

  } catch (error) {
    console.error("Error creating subscription for A2 Cow Ghee:", error);

    // Send failure message to user
    const errorMessage = {
      text: "Failed to create subscription. Please try again later.",
    };
    await sendMessage(userPhone, errorMessage);

    // Notify the admin of subscription creation failure
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER'; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Alert: Subscription creation failed for ${userPhone}. Error: ${error.response ? error.response.data.description : error.message}`,
    };
    await sendMessage(adminPhone, adminMessage);
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
        amount: 400 * amountMultiplier / 500
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
      user.subscriptionId = subscription.id;
      user.subscriptionQuantity = subscription.quantity;
      user.subscriptionType = "Buffalo"
      user.subscriptionAmount = subscription.notes.amount;
    }

    // Set the reminder date to 7 days before the next cycle
    const reminderDate = new Date(user.deliveryDay);
    reminderDate.setDate(reminderDate.getDate() + 23);

    // Save the calculated reminder date
    user.nextReminderDate = reminderDate;
    await user.save();

    const today = new Date();
    let deliveryDate = new Date(today.getFullYear(), today.getMonth(), user.deliveryDay);

    // If the chosen day has already passed this month, set delivery to next month
    if (deliveryDate < today) {
      deliveryDate.setMonth(today.getMonth() + 1);
    }

    // Send subscription confirmation message to the user
    const message = {
      text: `You have now subscribed to Our Monthly Plan of Buffalo Ghee. Your subscription will start on ${user.subscriptionStartDate.toDateString()} and will be delivered to the address: ${user.address} on or around ${deliveryDate.toDateString()}. Please complete your payment here to activate: ${subscription.short_url}`,
    };
    await sendMessage(userPhone, message);

    // Notify the admin of subscription and payment link creation
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER'; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Subscription created for ${userPhone}. Payment link: ${subscription.short_url}. Subscription ID: ${subscription.id}`,
    };
    await sendMessage(adminPhone, adminMessage);

    console.log("Subscription created with ID:", subscription.id);

  } catch (error) {
    console.error("Error creating subscription for Buffalo Ghee:", error);

    // Send failure message to user
    const errorMessage = {
      text: "Failed to create subscription. Please try again later.",
    };
    await sendMessage(userPhone, errorMessage);

    // Notify the admin of subscription creation failure
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER'; // Replace with your admin phone or load from env
    const adminMessage = {
      text: `Alert: Subscription creation failed for ${userPhone}. Error: ${error.response ? error.response.data.description : error.message}`,
    };
    await sendMessage(adminPhone, adminMessage);
  }
}



// Handle address input
async function handleAddressInput(messageText, userPhone) {
  const user = await User.findOne({ phone: userPhone });
  if (
    useradd[userPhone] === "awaiting_address" ||
    useradd[userPhone] === "awaiting_edit_address"
  ) {
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
          title: "Edit Address",
        },
        {
          id: "same_address",
          title: "Same Address",
        },
      ],
    };

    // Send button message with the two ghee options
    // console.log(rewriteAddress);
    await sendMessage(userPhone, rewriteAddress);
    return;
  }

  if (
    useradd[userPhone] === "awaiting_same_address" ||
    useradd[userPhone] === "awaiting_edit_address"
  ) {
    let message;
    console.log(user.address);

    if (
      planType[userPhone] === "plan_buffalo" ||
      planType[userPhone] === "plan_A2"
    ) {
      message = {
        text: "Thank you for providing your address! Now, let us know the day on which you want to deliver your order (1-31)",
      };

      // Update user state to await subscription date

      useradd[userPhone] = "awaiting_subscription_date";
      await sendMessage(userPhone, message);
      return;
    } else {
      useradd[userPhone] = "";
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

//edit date

// for future use
// async function handleExistingSubscriptionDateInput(messageText, userPhone) {
//   // Regular expression to match YYYY-MM-DD format
//   const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

//   // Check if the messageText matches the date format
//   if (!dateFormat.test(messageText)) {
//     const errorMessage = {
//       text: "Please enter a valid date in YYYY-MM-DD format.",
//     };
//     await sendMessage(userPhone, errorMessage);
//     return;
//   }

//   // Convert messageText to a Date object
//   const subscriptionDate = new Date(messageText);

//   // Validate if the parsed date is actually a valid date
//   if (isNaN(subscriptionDate.getTime())) {
//     const errorMessage = {
//       text: "The date provided is invalid. Please enter a real date (e.g., 2024-12-31).",
//     };
//     await sendMessage(userPhone, errorMessage);
//     return;
//   }

//   // Retrieve the user and update the subscription date
//   const user = await User.findOne({ phone: userPhone });
//   if (user) {
//     user.subscriptionStartDate = subscriptionDate;
//     await user.save();
//   }

//   // Confirm subscription start date
//   const message = {
//     text: Your subscription will start on ${subscriptionDate.toDateString()}. Pay to Subscribe,
//   };
//   await sendMessage(userPhone, message);
// }

// Handle subscription date input
async function handleSubscriptionDateInput(messageText, userPhone) {
  const dayOfMonth = parseInt(messageText, 10);

  // Validate that the input is a valid day of the month (1-31)
  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    const errorMessage = {
      text: "Please enter a valid day of the month (e.g., 1-31).",
    };
    await sendMessage(userPhone, errorMessage);
    return;
  }

  // Find the user in the database
  const user = await User.findOne({ phone: userPhone });
  if (user) {
    // Determine the next delivery date based on the entered day
    const today = new Date();
    let deliveryDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);

    // If the chosen day has already passed this month, set delivery to next month
    if (deliveryDate < today) {
      deliveryDate.setMonth(today.getMonth() + 1);
    }

    const subscriptionDate = new Date();

    // Save the user's preferred day and the calculated first delivery date
    user.deliveryDay = dayOfMonth;
    user.subscriptionStartDate = subscriptionDate;
    await user.save();
  }

  // Send confirmation message to the user
  const message = {
    text: `Your subscription deliveries will start on ${user.subscriptionStartDate.toDateString()} and continue on the ${dayOfMonth} of each month. Please complete your payment to activate your subscription.`,
  };
  await sendMessage(userPhone, message);

  // Create subscription after collecting all required info
  if (planType[userPhone] === "plan_A2") {
    await createSubscriptionA2(userPhone, userAmount);
  } else if (planType[userPhone] === "plan_buffalo") {
    await createSubscriptionBuffalo(userPhone, userAmount);
  }
}


// Create subscription using Razorpay