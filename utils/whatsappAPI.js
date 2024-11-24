const axios = require('axios');
const https = require('https');


exports.sendMessage = async (phone, content) => {
  const url = `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // const httpsAgent = new https.Agent({
  //   cert:"Cm8KKwiWl6L6+qznAhIGZW50OndhIhJOYW5pJ3MgQmlsb25hIEdoZWVQ4O32uQYaQDjBeL0jA/WsbmeAd2YC1qOvADFoyycRsMN6tvCUC0MtLn0FG8rodAbfGpZ+5ju9J9zRB5JD8vuKyVhaiTXDrwsSLm0PY5ftppxD4ESHs5GpbCGVU+HjXMPY/as6OE6tPF4vdVEkznys9ThNXJJ/zQg=",
  // })

  try {
    // Ensure `phone` (the `to` parameter) is provided
    if (!phone) {
      throw new Error('Recipient phone number is missing');
    }

    // Send text message if content.text exists
    if (content.text) {
      const textData = {
        messaging_product: 'whatsapp',
        cert:"Cm8KKwiWl6L6+qznAhIGZW50OndhIhJOYW5pJ3MgQmlsb25hIEdoZWVQ4O32uQYaQDjBeL0jA/WsbmeAd2YC1qOvADFoyycRsMN6tvCUC0MtLn0FG8rodAbfGpZ+5ju9J9zRB5JD8vuKyVhaiTXDrwsSLm0PY5ftppxD4ESHs5GpbCGVU+HjXMPY/as6OE6tPF4vdVEkznys9ThNXJJ/zQg=",
        to: phone,  // This should be the recipient phone number
        type: 'text',
        text: {
          body: content.text,
        },
      };
      await axios.post(url, textData, { headers });
      console.log('Text message sent successfully');
    }

    // Send media messages if content.media exists and is an array
    if (content.media && Array.isArray(content.media)) {
      for (const media of content.media) {
        const mediaData = {
          messaging_product: 'whatsapp',
          cert:"Cm8KKwiWl6L6+qznAhIGZW50OndhIhJOYW5pJ3MgQmlsb25hIEdoZWVQ4O32uQYaQDjBeL0jA/WsbmeAd2YC1qOvADFoyycRsMN6tvCUC0MtLn0FG8rodAbfGpZ+5ju9J9zRB5JD8vuKyVhaiTXDrwsSLm0PY5ftppxD4ESHs5GpbCGVU+HjXMPY/as6OE6tPF4vdVEkznys9ThNXJJ/zQg=",
          to: phone,  // Ensure `to` is included here as well
          type: media.type,
          [media.type]: {
            link: media.url, // URL of the image/video/audio
          },
        };
        await axios.post(url, mediaData, { headers });
        console.log(`${media.type.charAt(0).toUpperCase() + media.type.slice(1)} message sent successfully`);
      }
    }

    // Send interactive button message if content.buttons exists and is an array
    if (content.buttons && Array.isArray(content.buttons)) {
      const interactiveMessage = {
        messaging_product: 'whatsapp',
        cert:"Cm8KKwiWl6L6+qznAhIGZW50OndhIhJOYW5pJ3MgQmlsb25hIEdoZWVQ4O32uQYaQDjBeL0jA/WsbmeAd2YC1qOvADFoyycRsMN6tvCUC0MtLn0FG8rodAbfGpZ+5ju9J9zRB5JD8vuKyVhaiTXDrwsSLm0PY5ftppxD4ESHs5GpbCGVU+HjXMPY/as6OE6tPF4vdVEkznys9ThNXJJ/zQg=",
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: content.buttons.text || 'Choose an option below:',  // Default text if none provided
          },
          action: {
            buttons: content.buttons.map((button) => ({
              type: 'reply',
              reply: {
                id: button.id,  // Unique identifier for the button
                title: button.title,  // The text that appears on the button
              },
            })),
          },
        },
      };

      await axios.post(url, interactiveMessage, { headers });
      console.log('Interactive button message sent successfully');
    }
    return;
  } catch (error) {
    // Log error details for debugging
    if (error.response) {
      console.error('Error data:', error.response.data);
      
    } else {
      console.error('Error sending message:', error.message);
    }
  }
  return;
};
