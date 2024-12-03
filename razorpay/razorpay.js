const axios = require('axios');
const { sendMessage } = require("../utils/whatsappAPI");
const User = require('../models/User');

// Function to calculate and create Razorpay payment link
exports.generatePaymentLinkWithDivision = async (amountEntered, userPhone, description = "Purchase at Nani's Bilona Ghee") => {
  const url = 'https://api.razorpay.com/v1/payment_links';
  const auth = {
    username: process.env.RAZORPAY_KEY_ID,
    password: process.env.RAZORPAY_KEY_SECRET,
  };

  // Calculate the amount by dividing by 500, then convert to paise (for Razorpay)
  const calculatedAmount = Math.round(amountEntered / 500) * 100; // Amount in paise

  const user = await User.findOne({phone:userPhone})
  user.userOrderAmount = calculatedAmount;
  user.save()

  try {
    const response = await axios.post(
      url,
      {
        amount: calculatedAmount,
        currency: 'INR',
        description: description,
        customer: {
          contact: userPhone,
        },
        notify: {
          sms: true,
          email: true,
          whatsapp: true,
        },
        callback_url: process.env.CALLBACK_URL, // Update as needed
        callback_method: 'get',
      },
      { auth }
    );

    const paymentLink = response.data.short_url;
    
    // Send success notification to the admin
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER';
    const successMessage = {
      text: `Payment link created successfully for ${userPhone}. Link: ${paymentLink}`,
    };
    await sendMessage(adminPhone, successMessage);

    return paymentLink;
  } catch (error) {

    // Send error message to the admin
    const adminPhone = process.env.ADMIN_PHONE || 'YOUR_ADMIN_PHONE_NUMBER';
    const errorMessage = {
      text: `Alert: Failed to create payment link for ${userPhone}. Error: ${error.response ? error.response.data.description : error.message}`,
    };
    await sendMessage(adminPhone, errorMessage);

    throw new Error('Failed to create payment link');
  }
};
