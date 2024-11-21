// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const crypto = require('crypto');
const { sendMessage } = require("../utils/whatsappAPI");
const User = require("../models/User"); // Adjust the path if necessar
const State = require("../models/State");
// const State = require('../models/State');



// GET request for webhook verification
router.get('/webhook', (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN; // Token in .env file
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Mode:', mode);
  console.log('Token received:', token);
  console.log('Challenge:', challenge);

  if (mode === 'subscribe' && token === verifyToken) {
    console.log("WEBHOOK_VERIFIED");
    res.status(200).send(challenge); // Respond with challenge to verify webhook
  } else {
    console.log("Verification failed - tokens do not match");
    res.sendStatus(403); // Forbidden if tokens do not match
  }
});


// POST request to handle messages
router.post('/webhook', whatsappController.receiveMessage);

module.exports = router;

// In your server.js or routes file


router.get('/payment-status', async (req, res) => {
  console.log("it is working");
  
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, userPhone } = req.query;
  
  // Validate required parameters
  if (!razorpay_order_id || !userPhone) {
    return res.status(400).send('Missing required parameters');
  }

  try {
    // Check if payment failed (i.e., no payment ID or signature provided)
    if (!razorpay_payment_id || !razorpay_signature) {
      const failureMessage = {
        text: `Your payment attempt was unsuccessful. Please try again or contact support if the issue persists.`,
      };
      await sendMessage(userPhone, failureMessage);

      // Notify admin of failed payment
      const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER';
      const adminFailureMessage = {
        text: `Alert: Payment failed for user ${userPhone}. No payment ID was received.`,
      };
      await sendMessage(adminPhone, adminFailureMessage);

      console.log('Payment failed for user:', userPhone);
      return res.status(400).send('Payment failed');
    }

    // Generate signature to verify Razorpay's callback authenticity
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Verify the signature
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).send('Invalid signature');
    }

    // Update user's payment status to reflect successful payment
    const user = await User.findOneAndUpdate(
      { phone: userPhone },
      { userOrderPaymentID: razorpay_payment_id }, // Update with relevant field for payment ID
      { new: true }
    );

    
    // Notify user of successful payment
    const successMessage = {
      text: `Payment successful! Thank you for your purchase!`,
    };
    await sendMessage(userPhone, successMessage);

    // Notify admin of successful payment
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER';
    const adminSuccessMessage = {
      text: `Payment successful for ${userPhone}. Payment ID: ${razorpay_payment_id}.`,
    };
    await sendMessage(adminPhone, adminSuccessMessage);

    console.log('Payment successful with ID:', razorpay_payment_id);
    res.status(200).send('Payment processed');
  } catch (error) {
    console.error('Error handling payment status:', error);
    res.status(500).send('Server error processing payment');
  }
});


router.post('/payment-success', async (req, res) => {
  const secret = process.env.VERIFY_TOKEN;

  // Verify the signature to authenticate Razorpay's webhook
  const receivedSignature = req.headers['x-razorpay-signature'];
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (generatedSignature !== receivedSignature) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body.event;
  const paymentData = req.body.payload.payment ? req.body.payload.payment.entity : null;
  const subscriptionData = req.body.payload.subscription ? req.body.payload.subscription.entity : null;
  const userPhone = paymentData ? paymentData.contact : subscriptionData ? subscriptionData.notes.phone : null;
  const amount = paymentData ? paymentData.amount / 100 : subscriptionData ? subscriptionData.notes.amount / 100 : null; // Convert paise to rupees

  if (!userPhone) {
    return res.status(400).send('User phone number missing');
  }

  try {
    if (event === 'payment.captured') {
      // Handle successful one-time payment
      const user = await User.findOneAndUpdate(
        { phone: userPhone },
        { userOrderPaymentID: paymentData.id }, // Store the successful payment ID
        { new: true }
      );

      user.singleorderPaymentStatus = true;

      // Send success message to user
      const successMessage = {
        text: `Payment successful! Thank you for your purchase of ₹${amount}.`,
      };
      await sendMessage(userPhone, successMessage);

      console.log('Payment success notification sent to user:', userPhone);

    } else if (event === 'payment.failed') {
      // Handle failed one-time payment
      const failureReason = paymentData.error_description || 'Unknown error';

      // Send failure message to user
      const failureMessage = {
        text: `Payment failed for ₹${amount}. Please try again. Reason: ${failureReason}`,
      };
      await sendMessage(userPhone, failureMessage);

      // Notify the admin of the payment failure
      const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER';
      const adminMessage = {
        text: `Alert: Payment of ₹${amount} failed for ${userPhone}. Reason: ${failureReason}`,
      };
      await sendMessage(adminPhone, adminMessage);

      console.log('Payment failure notification sent to admin and user:', userPhone);

    } else if (event === 'subscription.charged') {
      // Handle successful subscription charge
      const user = await User.findOneAndUpdate(
        { phone: userPhone },
        { subscriptionId: subscriptionData.id }, // Store or update subscription ID
        { new: true }
      );

      user.subscriptionPaymentStatus = true;

      const successMessage = {
        text: `Subscription renewal successful for ₹${amount}. Thank you for continuing with our service!`,
      };
      await sendMessage(userPhone, successMessage);

      console.log('Subscription charge success notification sent to user:', userPhone);

    } else if (event === 'subscription.payment_failed') {
      // Handle failed subscription payment
      const failureReason = paymentData ? paymentData.error_description : 'Payment failure during subscription renewal';

      // Send failure message to user
      const failureMessage = {
        text: `Subscription renewal payment of ₹${amount} failed. Please update your payment method. Reason: ${failureReason}`,
      };
      await sendMessage(userPhone, failureMessage);

      // Notify admin of the subscription payment failure
      const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER';
      const adminMessage = {
        text: `Alert: Subscription renewal payment of ₹${amount} failed for ${userPhone}. Reason: ${failureReason}`,
      };
      await sendMessage(adminPhone, adminMessage);

      console.log('Subscription payment failure notification sent to admin and user:', userPhone);
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error handling payment webhook:', error);
    res.status(500).send('Server error processing payment');
  }
});


