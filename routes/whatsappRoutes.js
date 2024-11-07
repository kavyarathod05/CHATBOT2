// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// GET request for webhook verification
router.get('/', (req, res) => {
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
router.post('/', whatsappController.receiveMessage);

module.exports = router;
