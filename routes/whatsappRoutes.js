// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

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


router.get('/payment-success', async (req, res) => {
  const { razorpay_payment_id, razorpay_signature } = req.query;
  
  // Use Razorpay's utility methods to verify the signature and confirm the payment
  // Ensure you validate `razorpay_signature` to secure the callback

  if (!razorpay_payment_id || !razorpay_signature) {
    return res.status(400).send('Missing required parameters');
  }

  // Here you would handle payment success logic
  // e.g., updating order status, notifying user, etc.
  console.log('Payment successful with ID:', razorpay_payment_id);
  
  res.status(200).send('Payment processed');
});


