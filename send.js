const axios = require('axios');
require('dotenv').config(); // Load .env variables

const phoneNumberId = process.env.PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_ACCESS_TOKEN;

// Helper function to send a message
async function sendMessage(phoneNumber, templateName, dynamicValue) {
  const apiUrl = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      apiUrl,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: welcome,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: dynamicValue,
                },
              ],
            },
          ],
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
