const axios = require('axios');

// Function to calculate and create Razorpay payment link
exports.generatePaymentLinkWithDivision = async(amountEntered, userPhone, description = "Purchase at Nani's Bilona Ghee") => {
  const url = 'https://api.razorpay.com/v1/payment_links';
  const auth = {
    username: process.env.RAZORPAY_KEY_ID,
    password: process.env.RAZORPAY_KEY_SECRET,
  };

  // Calculate the amount by dividing by 500, then convert to paise (for Razorpay)
  const calculatedAmount = Math.round(amountEntered / 500)*100;
  console.log(calculatedAmount);
  

  try {
    const response = await axios.post(
      url,
      {
        amount: calculatedAmount, // Amount in paise
        currency: 'INR',
        description: description,
        customer: {
          contact: userPhone,
        },
        notify: {
          sms: true,
          email: false, // Set to true if you also want email notifications
        },
        callback_url: 'https://7162-117-250-157-213.ngrok-free.app/payment-success', // Define your callback URL here
        callback_method: 'get',
      },
      { auth }
    );

    return response.data.short_url; // Returns the payment link
  } catch (error) {
    console.error('Error creating payment link:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create payment link');
  }
}
