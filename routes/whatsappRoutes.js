// routes/whatsappRoutes.js
const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsappController");
const crypto = require("crypto");
const { sendMessage } = require("../utils/whatsappAPI");
const User = require("../models/User"); // Adjust the path if necessar
const State = require("../models/State");
// const State = require('../models/State');
const Razorpay = require("razorpay");
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// GET request for webhook verification
router.get("/webhook", (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN; // Token in .env file
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Store processed message timestamps (you can use a database or in-memory storage)
const processedMessages = new Map();

// Define a threshold in milliseconds (e.g., 5 minutes)
const MESSAGE_PROCESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes

const MIN_TIMESTAMP_DIFF = 5 * 60 * 1000; // 5 minutes threshold in milliseconds

router.post("/webhook", (req, res) => {
  try {
    const payload = req.body;

    // Log the full payload for debugging purposes

    // Extract relevant data from the payload
    const changes = payload.entry?.[0]?.changes?.[0]?.value;

    // Check if the event contains actual messages
    if (changes?.messages && Array.isArray(changes.messages)) {
      const messages = changes.messages;

      // Get current timestamp
      const currentTimestamp = Date.now(); // Get the current timestamp in milliseconds

      // Check each message in the messages array
      messages.forEach((message) => {
        // Ensure this is a user-generated message
        if (message.type && message.from) {
          // Extract timestamp from the message
          const messageTimestamp = parseInt(message.timestamp, 10) * 1000; // Convert to milliseconds

          // Check if the timestamp difference is within an acceptable range (e.g., 5 minutes)
          const timestampDifference = currentTimestamp - messageTimestamp;

          // If the timestamp difference is too large, consider it as a duplicate/random message
          if (timestampDifference > MIN_TIMESTAMP_DIFF) {
            return; // Skip processing this message
          }

          whatsappController.receiveMessage(req, res); // Call your controller
        } else {
        }
      });

      res.status(200).send("Message processed");
    } else {
      res.status(200).send("No valid messages to process");
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});
router.get("/payment-done", (req, res) => {
  try {
    const { razorpay_payment_id } = req.query;
    // const event = req.body?.event || null;
    // const paymentData = req.body?.payload?.payment
    //   ? req.body.payload.payment.entity
    //   : null;

    // console.log(paymentData);
    // if (!paymentData || !paymentData.contact) {
    //   return res.status(400).send("Invalid payment data");
    // }

    // const userPhone = paymentData.contact.replace('+', '');

    // Customize the WhatsApp message link
    const whatsappNumber =919518095606; // Corrected to use userPhone directly
    const message = encodeURIComponent(
      `Thank you for your payment!`
    );
    const whatsappRedirectURL = `https://wa.me/${whatsappNumber}`;

    // Redirect user to WhatsApp
    res.redirect(whatsappRedirectURL);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

router.post("/payments-success", async (req, res) => {
  const secret = process.env.VERIFY_TOKEN;

  // Verify the signature to authenticate Razorpay's webhook
  const receivedSignature = req.headers["x-razorpay-signature"];
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (generatedSignature !== receivedSignature) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const paymentData = req.body.payload.payment
    ? req.body.payload.payment.entity
    : null;
  const subscriptionData = req.body.payload.subscription
    ? req.body.payload.subscription.entity
    : null;
  if (!paymentData.contact) {
      throw new Error('Contact information is missing in payment data');
  }
  const userPhone = paymentData.contact.replace('+', '');
  
  const amount = paymentData
    ? paymentData.amount / 100
    : subscriptionData
    ? subscriptionData.notes.amount / 100
    : null; // Convert paise to rupees

  if (!userPhone) {
    return res.status(400).send("User phone number missing");
  }

  try {
    if (event === "payment.captured") {
      
      // Define subscription amounts (for subscription orders)
      const subscriptionAmounts = [
        6888, 5031, 4272, 4366, 3607, 2942, 2848, 2183, 1424, 759,
        7837, 7310, 6456, 5696, 4842, 4082, 3228, 2468, 1614, 854,
      ];
    
      const user = await User.findOneAndUpdate(
        { phone: userPhone },
        { userOrderPaymentID: paymentData.id },
        { new: true }
      );
      const name = user.name;
      const address = user.address;
    
      if (!user) {
        return res.status(404).send("User not found");
      }
    
      // Check if the amount is for a subscription or single order
      if (subscriptionAmounts.includes(amount)) {
        // Handle subscription payment
        if (!user.subscription) {
          user.subscription = true;  // Mark the user as having a subscription
          user.subscriptionType = user.subscriptionType === "Buffalo" ?"Indian Buffalo Ghee": "A2 Cow Ghee"  ;
          // Update other subscription-specific fields if necessary
        }
    
        const successMessage = {
          text: `✅✅ *Payment Successful!* 🎉\n\nThank you, *${name}*, for your subscription! 🐄\n\n📜 *Order Summary:*\n——————————————\n🛍️ *Item:* ${user.subscriptionType}\n💳 *Amount Paid:* ₹${amount}\n📱 *Phone:* ${userPhone}\n📍 *Delivery Address:* ${address}\n——————————————\n\n🚚 *Your subscription is being activated, and you will receive a confirmation message within 2-3 minutes.* 📦\n\n💛 *Thank you for choosing Nani’s Bilona Ghee!*\nFor queries, feel free to reach out. We’re here to help! 🌟\n\n📞 *Customer Support:* ${process.env.CUSTOMER_SUPPORT_CONTACT}\n\n✨ Stay healthy, stay happy! ✨`,
        };
        
    
        // Save the user data with the updated subscription status
        await user.save();
        await sendMessage(userPhone, successMessage);
    
        // Notify admin about the subscription order
        const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER";
        const adminSuccessMessage = {
          text: `✅ *Payment Received for subscription order!*\n\n📞 *Customer Name:* ${user.name} *Customer Phone:* ${userPhone}\n💳 *Amount Paid:* ₹${amount}\n🛍️ *Item:* ${user.subscriptionType}\n📍 *Delivery Address:* ${address}\n\n📦 Order will be delivered within 4-5 business days.\n\n✨ *Payment ID:* ${paymentData.id}\n✨ *Subscription ID:* ${user.subscriptionId}\n\n💼 Please process the order promptly.\n\n📅 *Estimated Delivery Date:* ${user.deliveryDate.toLocaleString}`,
        };
        
        await sendMessage(adminPhone, adminSuccessMessage);
      } else {
        // Handle single order payment
        user.singleorderPaymentStatus = true;
        await user.save();
    
      const  successMessage = {
          text: `✅✅ *Payment Successful!* 🎉\n\nThank you, *${name}*, for your purchase! 🐄\n\n📜 *Order Summary:*\n——————————————\n🛍️ *Item:* ${user.userOrderType === "A2" ? "A2 Cow Ghee" : "Indian Buffalo Ghee"}\n🔢 *Quantity:* ${user.userOrderQuantity}ml\n💳 *Amount Paid:* ₹${amount}\n📱 *Phone:* ${userPhone}\n📍 *Delivery Address:* ${address}\n——————————————\n\n🚚 *Delivery Info:*\nYour order will be delivered within **4-5 business days**. 📦\n\n💛 *Thank you for choosing Nani’s Bilona Ghee!*\nFor queries, feel free to reach out. We’re here to help! 🌟\n\n📞 *Customer Support:* ${process.env.CUSTOMER_SUPPORT_CONTACT}\n\n✨ Stay healthy, stay happy! ✨`,
        };
    
        // Send message for single order payment
        await sendMessage(userPhone, successMessage);
    
        // Notify admin about the single order payment
        const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER";
        const adminSuccessMessage = {
          text: `✅ *Payment Received for single order!*\n\n📞 *Customer Name:* ${user.name} *Customer Phone:* ${userPhone}\n💳 *Amount Paid:* ₹${amount}\n🛍️ *Item:* ${user.userOrderType === "A2" ? "A2 Cow Ghee" : "Indian Buffalo Ghee"}\n📍 *Delivery Address:* ${address}\n\n📦 Order will be delivered within 4-5 business days.\n\n✨ *Payment ID:* ${paymentData.id}\n\n💼 Please process the order promptly.`,
        };
        await sendMessage(adminPhone, adminSuccessMessage);
      }
    
      return res.status(200).send("Payment processed");
    }
    else if (event === "payment.failed") {
      // Handle failed one-time payment
      const failureReason = paymentData.error_description || "Unknown error";
      const user = await User.findOne({ phone: userPhone });
  
      // List of subscription amounts
      const subscriptionAmounts = [
          6888, 5031, 4272, 4366, 3607, 2942, 2848, 2183, 1424, 759, 
          7837, 7310, 6456, 5696, 4842, 4082, 3228, 2468, 1614, 854, 7837
      ];
  
      // Convert the amount to a number (from formatted string)
      const formattedAmount = parseInt(amount.replace(/[^0-9]/g, ''));
  
      // Send failure message to user
      let failureMessage, adminMessage;
  
      if (subscriptionAmounts.includes(formattedAmount)) {
          // If the amount matches a subscription amount
          const subsorder = user.subscriptionType === "Buffalo" ? "Indian Buffalo Ghee" : "A2 Cow Ghee";
          failureMessage = {
              text: `❌ *Payment Failed* for subscription ❌\n\nHi *${user.name}*,\n\nWe regret to inform you that your payment of ₹${amount} for your *${subsorder}* subscription could not be processed. 😔\n\n📜 *Subscription Summary:*\n——————————————\n🛍️ *Subscription Type:* ${subsorder}\n📱 *Phone:* ${userPhone}\n📍 *Delivery Address:* ${user.address}\n⚠️ *Reason:* ${failureReason}\n——————————————\n\n🔄 You can retry the payment or contact us for assistance. 💛\n\n✨ We’re here to help you enjoy the goodness of Nani’s Bilona Ghee! 🌟`,
          };
  
          // Admin message for subscription failure
          adminMessage = {
              text: `❌ *Payment Failure Alert: Subscription* ❌\n\n📞 Name:*${user.name}* \n *Customer Phone:* ${userPhone}\n👤 *Customer Name:* ${user.name}\n💳 *Attempted Amount:* ₹${amount}\n🛍️ *Subscription Type:* ${subsorder}\n📍 *Delivery Address:* ${user.address}\n⚠️ *Failure Reason:* ${failureReason}\n💼 *Payment ID:* ${paymentData.id}\n Delivery date: ${user.deliveryDate.toLocaleString}\nPlease review and follow up with the customer to resolve the issue.`,
          };
      } else {
          // If the amount is not a subscription amount (single order)
          const orderTypeDescription = user.userOrderType === "A2" ? "A2 Cow Ghee" : "Indian Buffalo Ghee";
          failureMessage = {
              text: `❌ *Payment Failed* ❌\n\nHi *${user.name}*,\n\nWe regret to inform you that your payment of ₹${amount} for *${orderTypeDescription}* could not be processed. 😔\n\n📜 *Order Summary:*\n——————————————\n🛍️ *Item:* ${orderTypeDescription}\n🔢 *Quantity:* ${user.userOrderQuantity}ml\n📱 *Phone:* ${userPhone}\n📍 *Delivery Address:* ${user.address}\n⚠️ *Reason:* ${failureReason}\n——————————————\n\n🔄 You can retry the payment or contact us for assistance. 💛\n\n✨ We’re here to help you enjoy the goodness of Nani’s Bilona Ghee! 🌟`,
          };
  
          // Admin message for single order failure
          adminMessage = {
              text: `❌ *Payment Failure Alert: Order Purchase* ❌\n\n📞 *Customer Phone:* ${userPhone}\n👤 *Customer Name:* ${user.name}\n💳 *Attempted Amount:* ₹${amount}\n🛍️ *Item:* ${orderTypeDescription}\n🔢 *Quantity:* ${user.userOrderQuantity}ml\n📍 *Delivery Address:* ${user.address}\n⚠️ *Failure Reason:* ${failureReason}\n💼 *Payment ID:* ${paymentData.id}\n\nPlease review and follow up with the customer to resolve the issue.`,
          };
      }
  
      // Send failure messages to the user and admin
      await sendMessage(userPhone, failureMessage);
      await sendMessage(process.env.ADMIN_PHONE || "918198985878", adminMessage);
  
      return res.status(200).send("Payment failure handled");
  }
  
    //  else if (event === "subscription.charged") {
    //   // Handle successful subscription charge
    //   const user = await User.findOneAndUpdate(
    //     { phone: userPhone },
    //     { subscriptionId: subscriptionData.id }, // Store or update subscription ID
    //     { new: true }
    //   );
    //   const address = user.address;
    //   const subscriptionType = user.subscriptionType;
    //   const subscrptionStartDatee = user.subscriptionStartDate;
    //   const nextremdate = user.nextReminderDate;
    //   user.subscriptionPaymentStatus = true;
    //   await user.save();

    //   const successMessage = {
    //     text: `Subscription done . Thank you for continuing with our service!`,
    //   };
    //   await sendMessage(userPhone, successMessage);

    //   const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER";
    //   const adminSuccessMessage = {
    //     text: `✅ Payment received!\n User with ID: ${userId} \n Subscription Type : ${subscriptionType} \n Subscription Start Date: ${subscrptionStartDatee} \n Address: ${address} \n UserPhone ${userPhone} has successfully completed the payment of:\n ₹${amount} for subscription ${subscriptionId}.\n Its Next Remainder Date is ${nextremdate}\n`,
    //   };
    //   await sendMessage(adminPhone, adminSuccessMessage);
    //   return res.status(200).send("sub charged");
    // } else if (event === "subscription.payment_failed") {
    //   // Handle failed subscription payment
    //   const failureReason = paymentData
    //     ? paymentData.error_description
    //     : "Payment failure during subscription renewal";

    //   // Send failure message to user
    //   const failureMessage = {
    //     text: `Subscription renewal payment of ₹${amount} failed. Please update your payment method. Reason: ${failureReason}`,
    //   };
    //   await sendMessage(userPhone, failureMessage);

    //   // Notify admin of the subscription payment failure
    //   const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER";
    //   const adminMessage = {
    //     text: `Alert: Subscription renewal payment of ₹${amount} failed for ${userPhone}. Reason: ${failureReason}`,
    //   };

    //   await sendMessage(adminPhone, adminMessage);
    //   return res.status(200).send("Subscription payment failed handled"); // Only one response here
    // }

    res.status(200).send("Webhook received");
  } catch (error) {
    res.status(500).send("Server error processing payment");
    console.log(error);
  }
});

router.post("/subs-success", async (req, res) => {
  const secret = process.env.VERIFY_TOKEN;
  // Verify the signature to authenticate Razorpay's webhook
  const receivedSignature = req.headers["x-razorpay-signature"];
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (generatedSignature !== receivedSignature) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const paymentData = req.body.payload.payment
    ? req.body.payload.payment.entity
    : null;
  const subscriptionData = req.body.payload.subscription
    ? req.body.payload.subscription.entity
    : null;
  // const userPhone = paymentData
  //   ? paymentData.contact.replace(/^\+/, "") // Remove leading `+` // Remove leading `+`
  //   : subscriptionData
  //   ? (subscriptionData.notes = (subscriptionData.notes || "")
  //       .toString()
  //       .replace(/^\+/, ""))
  //   : null;
  const userPhone = subscriptionData && subscriptionData.notes
  ? subscriptionData.notes.phone
  : null;

  const amount = paymentData
    ? paymentData.amount
    : subscriptionData
    ? subscriptionData.notes.amount / 100
    : null; // Convert paise to rupees

  if (!userPhone) {
    return res.status(400).send("User phone number missing");
  }

  try {
    if (event === "subscription.charged") {
      // Handle successful subscription charge
      const user = await User.findOneAndUpdate(
        { phone: userPhone },
        { subscriptionId: subscriptionData.id }, // Store or update subscription ID
        { new: true }
      );
      const address = user.address;
      const subscriptionType = user.subscriptionType;
      const subscrptionStartDatee = user.subscriptionStartDate;
      const nextremdate = user.nextReminderDate;
      user.subscriptionPaymentStatus = true;
      user.delivered = false;
      user.remindersent= false;
      const currentMonth = new Date().getMonth(); // Current month (0-11)
      const subscriptionStartMonth = new Date(user.subscriptionStartDate).getMonth(); // Month of the subscription start date
    
      // Check if the current month is different from the subscription start month
      if (currentMonth !== subscriptionStartMonth) {
        // Update deliveryDate by increasing it by one month
        const newDeliveryDate = new Date(user.deliveryDate);
        newDeliveryDate.setMonth(newDeliveryDate.getMonth() + 1); // Advance by one month
        user.deliveryDate = newDeliveryDate;
      }
      
      await user.save();
      const subsorder = user.subscriptionType === "Buffalo" ? "Indian Buffalo Ghee" : "A2 Cow Ghee";

      const successMessage = {
        text: `🪔✨ *Subscription Activated!! ${user.name}* 🎉\nPure ghee, delivered with care, right to your doorstep! 🧈\n📄 *Payment Details:*\n——————————————\n📅 *Subscription Type:* ${subsorder}\n🛡️ *Subscription Start Date:* ${subscrptionStartDatee.toLocaleDateString()}\n🚚 *Delivery Date:* Around ${user.deliveryDate.toLocaleDateString()}\n📍 *Address:* ${address}\n📱 *User Phone:* ${userPhone}\n💰 *Amount Paid:* ₹${
          amount / 100
        }\n📦 *Subscription Quantity:* ${
          user.subscriptionQuantity
        }ml\n\n——————————————\n✨*You can view your plan and edit its details anytime by typing 'Hi' and clicking on *View Your Plans*.\n\nFor customer support, contact: ${
          process.env.CUSTOMER_SUPPORT_CONTACT
        }`,
      };

      await sendMessage(userPhone, successMessage);

      const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER";
      const adminSuccessMessage = {
        text: `✅✅ Subscription Created for \n Name:${user.name}  \n Address: ${address} \n UserPhone ${userPhone}\n User with payment ID : ${
          paymentData.id
        } \n Subscription Type : ${subscriptionType} \n Quantity: ${user.subscriptionQuantity} \n Subscription Start Date: ${subscrptionStartDatee.toLocaleDateString()}\n *Delivery Date:* ${user.deliveryDate.toLocaleDateString()} has successfully completed the payment of: ₹${
          amount / 100
        } for subscription ${
          subscriptionData.id
        }.\n Its Next Remainder Date is ${nextremdate.toLocaleDateString()}\n`,
      };
      await sendMessage(adminPhone, adminSuccessMessage);
      return res.status(200).send("sub charged");
    }
    else if(event==="subscription.pending"){}
     else if (event === "subscription.halted") {
      // Handle failed subscription payment

      const failureReason = paymentData
        ? paymentData.error_description
        : "Payment failure during subscription renewal";

      console.log(subscriptionData);
      const user = await User.findOne({ phone: userPhone }).exec();
      console.log(userPhone);
      console.log(user);
      
      if (user.subscriptionPaymentStatus && user.subscriptionPaymentStatus!=null && user) {
        user.subscriptionPaymentStatus = false; // Mark the payment status as failed
      }
      await user.save();

      // Cancel the existing subscription
      if (user.subscriptionId) {
        await razorpayInstance.subscriptions.cancel(user.subscriptionId);
        user.subscriptionId += "cancelled";
      }

      // Create a new subscription with the same details
      const description = "Monthly Subscription of A2 Cow Ghee";

      const newSubscriptionData = await razorpayInstance.subscriptions.create({
        plan_id: user.planId, // Assuming user.subscriptionType stores the plan ID
        customer_notify: 1,
        total_count: 12, // Total cycles for the subscription
        quantity: 1, // Use calculated price or default quantity
        notes: {
          phone: userPhone,
          description: description,
          amount: parseInt(user.subscriptionAmount, 10),
        },
      });

      // Update user record with new subscription ID
     // user.subscriptionId = newSubscriptionData.id;
      // user.subscriptionPaymentStatus = true; // Reset payment status
      user.delivered = false;
      user.deliveryDate = new Date(new Date(user.deliveryDate).setDate(new Date(user.deliveryDate).getDate() + 4));
      user.subscriptionStartDate = new Date(); // Update start date to current date

      await user.save();

      // Send failure message to user about the failed payment
      const failureMessage = {
        text: `Subscription renewal payment of ₹${user.subscriptionAmount} failed. Please update your payment method. Reason: ${failureReason}`,
      };
      await sendMessage(userPhone, failureMessage);

      const paymentLinkMessage = {
        text: `🚨 *Payment Required to Reactivate Your Subscription!* 🚨\n\nSubscription renewal failed. To continue your subscription for ${user.subscriptionType}, please complete the payment using the following link:\n\n🔗 *Payment Link:* ${newSubscriptionData.short_url}\n\n💰 *Amount:* ₹${user.subscriptionAmount}\n📦 *Quantity:* ${user.subscriptionQuantity}ml\n📝 *Description:* ${description}\n\n*New Delivery Date:* ${user.deliveryDate.toLocaleDateString()}\n\nOnce the payment is successful, your subscription will be reactivated. If you have any questions, contact our support at: ${process.env.CUSTOMER_SUPPORT_CONTACT}`
      };
      

      await sendMessage(userPhone, paymentLinkMessage);
      // Notify admin about the subscription payment failure
      const adminPhone = process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE_NUMBER";
      const adminMessage = {
        text: `⚠️ *Admin Alert: Payment Pending for Subscription Renewal!* ⚠️\n\n📄 *Customer Details:*\n——————————————\n👤 *Name:* ${user.name}\n📱 *Phone:* ${user.phone}\n📍 *Address:* ${user.address}\n\n📦 *Subscription Type:* ${user.subscriptionType}\n💰 *Pending Amount:* ₹${user.subscriptionAmount}\n🔗 *Payment Link:* ${newSubscriptionData.short_url}\n\n📝 *Description:* ${description}\n*Quantity:* ${user.subscriptionQuantity}ml\n🚚 *New Delivery Date:* ${user.deliveryDate.toLocaleDateString()}`
      };
      
      await sendMessage(adminPhone, adminMessage);

      // Send a success message after creating a new subscription

      return res
        .status(200)
        .send(
          "Subscription payment failed, handled and new subscription created"
        );
    }
    // else if(event==="subscription.cancelled"){
    //   const successMessage = {
    //     text: `cancelled uff`,
    //   };

    //   await sendMessage(userPhone, successMessage);
      
    // }

    res.status(200).send("Webhook received");
  } catch (error) {
  
    res.status(500).send("Server error processing payment");
    console.log(error);
  }
});

module.exports = router;
