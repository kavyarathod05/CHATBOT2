const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const db = require('./config/db.js');
const cron = require('node-cron'); // For cron scheduling
require('dotenv').config(); // Load environment variables

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Load environment variables
const phoneNumberId = process.env.PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_ACCESS_TOKEN;

// Import PhoneNumber model
const PhoneNumber = require('./models/phoneNumber');



// Schedule the task to run every day at 10:00 AM (adjust the time as needed)
cron.schedule('0 10 * * *', async () => {
    console.log('Starting daily broadcast message...');
    await sendBroadcastMessage();
    console.log('Daily broadcast message sent!');
});

// Start cron jobs for subscription reminders
const scheduleSubscriptionReminders = require('./reminder/scheduler.js');
scheduleSubscriptionReminders();

// Routes
const whatsappRoutes = require('./routes/whatsappRoutes');
app.use('/', whatsappRoutes); // Webhook for receiving WhatsApp messages

app.get('/', (req, res) => {
    console.log("abcd");
    res.status(200).send("Hello from Nani Belona Ghee!!");
})






// Helper function to send WhatsApp message
async function sendTemplateMessage(phoneNumber) {
    const apiUrl = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    try {
        const response = await axios.post(
            apiUrl,
            {
                messaging_product: 'whatsapp',
                to: `+${phoneNumber}`,
                type: 'template',
                template: {
                    name: 'welcome', 
                    language: { code: 'en' },
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`Message sent to ${phoneNumber}:`, response.data);
        return true;
    } catch (error) {
        console.error(`Failed to send message to ${phoneNumber}:`, error.response?.data || error.message);
        return false;
    }
}

// Function to send messages to all phone numbers that haven't received the message yet
async function sendBroadcastMessage() {
    try {
        // Fetch all phone numbers that haven't received the message
        const phoneNumbers = await PhoneNumber.find({ isMessageSent: false });
        console.log(phoneNumbers);
        console.log(`Found ${phoneNumbers.length} phone numbers to send messages.`);

        // Loop through and send the message
        for (const record of phoneNumbers) {
            const phoneNumber = record.userPhone;
            const success = await sendTemplateMessage(phoneNumber);

            // If message is sent successfully, update the database
            if (success) {
                await PhoneNumber.updateOne({ userPhone: phoneNumber }, { $set: { isMessageSent: true } });
                console.log(`Message successfully sent to ${phoneNumber}`);
            } else {
                console.log(`Failed to send message to ${phoneNumber}`);
            }
        }
        
    } catch (error) {
        console.error('Error sending broadcast messages:', error);
    }
    return;
}



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;