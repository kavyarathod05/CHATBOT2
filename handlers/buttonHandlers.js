const { sendMessage } = require('../utils/whatsappAPI');
const User = require('../models/User');  // Import your User model

// Handle Buy Ghee selection
exports.handleBuyGhee = async (userPhone, buttonId) => {
  // First message with the options to choose ghee products
  // const message = {
  //   text: "Great choice! Here are our ghee products:\n1. Pure Bilona Ghee - $20\n2. A2 Cow Ghee - $25\nWould you like to proceed with a purchase?"
  // };
  // await sendMessage(userPhone, message);

  // Message with buttons for choosing the variety of ghee
  const buttonMessage = {
    text: "Please choose the variety",
    buttons: [
      {
        id: "A2_ghee",
        title: "A2 Cow Ghee"
      },
      {
        id: "buffalo",
        title: "Buffalo Ghee"
      }
    ]
  };

  // Send button message with the two ghee options
  console.log(buttonMessage);
  await sendMessage(userPhone, buttonMessage);
};

exports.handleBuyGheeQuantity = async(userPhone, buttonId) => {
  // Handle A2_ghee selection
  if (buttonId === "A2_ghee") {
    const quantityMessage = {
      text: "You selected A2 Cow Ghee! Please choose the quantity you'd like to purchase:",
      buttons: [
        {
          id: "small_A2",
          title: "Small (500g)"
        },
        {
          id: "medium_A2",
          title: "Medium (1kg)"
        },
        {
          id: "large_A2",
          title: "Large (2kg)"
        }
      ]
    };

    // Send quantity options for A2 Ghee
    await sendMessage(userPhone, quantityMessage);
  }

  // Handle buffalo selection
  if (buttonId === "buffalo") {
    const quantityMessage = {
      text: "You selected Buffalo Ghee! Please choose the quantity you'd like to purchase:",
      buttons: [
        {
          id: "small_buffalo",
          title: "Small (500g)"
        },
        {
          id: "medium_buffalo",
          title: "Medium (1kg)"
        },
        {
          id: "large_buffalo",
          title: "Large (2kg)"
        }
      ]
    };

    // Send quantity options for Buffalo Ghee
    await sendMessage(userPhone, quantityMessage);
  }
};

// Handle customer support selection
exports.handleCustomerSupport = async (userPhone) => {
  const supportMessage = {
    text: "Our support team is here to assist you. How can we help you today?"
  };
  await sendMessage(userPhone, supportMessage);

  // Send button options for support
  const buttonMessage = {
    text: "Please select an option for customer support:",
    buttons: [
      {
        id: "technical_support",
        title: "Technical Support"
      },
      {
        id: "billing_inquiry",
        title: "Billing Inquiry"
      }
    ]
  };

  // Send customer support buttons
  await sendMessage(userPhone, buttonMessage);
};

// Handle B2B selection
exports.handleB2B = async (userPhone) => {
  const b2bMessage = {
    text: "Thank you for your interest in B2B! Please provide your business details so we can assist you further."
  };
  await sendMessage(userPhone, b2bMessage);

  // Send button message for B2B interaction
  const b2bButtonMessage = {
    text: "Please select your preferred service:",
    buttons: [
      {
        id: "b2b_product_inquiry",
        title: "Product Inquiry"
      },
      {
        id: "b2b_partnership_inquiry",
        title: "Partnership Inquiry"
      }
    ]
  };

  // Send B2B options
  await sendMessage(userPhone, b2bButtonMessage);
};