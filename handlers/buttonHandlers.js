const { sendMessage } = require('../utils/whatsappAPI');
const User = require('../models/User');  // Import your User model

// Handle Buy Ghee selection
exports.handleBuyGhee = async (userPhone, buttonId) => {
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
  console.log(buttonMessage);
  return await sendMessage(userPhone, buttonMessage);
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
        },
      ]
    };
    const customOrderMessage = {
      text: "If you'd like to order a custom quantity, please choose this Option",
      buttons: [
        {
          id: "custom_A2",
          title: "Custom Amount"
        },
      ]
    };

    const planOrderMessage = {
      text:" if you like to subscribe our monthly plan then click here ",
      buttons: [
        {
          id: "plan_A2",
          title: "Monthly Plan"
        },
      ]
    }

    // Send quantity options for A2 Ghee
    await sendMessage(userPhone, quantityMessage);
    await sendMessage(userPhone, customOrderMessage);
    return await sendMessage(userPhone, planOrderMessage);
    
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
      ],
      
    };
    const customOrderMessage = {
      text: "If you'd like to order a custom quantity, please choose this Option",
      buttons: [
        {
          id: "custom_buffalo",
          title: "Custom Amount"
        },
      ]
    };

    const planOrderMessage = {
      text: " if you like to subscribe our monthly plan then click here ",
      buttons: [
        {
          id: "plan_buffalo",
          title: "subscribe"
        },
      ]
    }

    // Send quantity options for Buffalo Ghee
    await sendMessage(userPhone, quantityMessage);
    await sendMessage(userPhone, customOrderMessage);
    return await sendMessage(userPhone, planOrderMessage);
    
  }
  return;
};


exports.handleCustomerSupport = async (userPhone) => {

  // Send initial support message
  const supportMessage = {
    text: "Our support team is here to assist you. We will contact you within 24 hours."
  };
  await sendMessage(userPhone, supportMessage);

  // Send button options for support
  const buttonMessage = {
    text: "Please click to continue",
    buttons: [
      {
        id: "help",
        title: "Continue"
      }
    ]
  };
  await sendMessage(userPhone, buttonMessage);
  
};


// Handle B2B selection
exports.handleknowaboutus = async (userPhone) => {
  const b2bMessage = {
    text: "this is nani bilona ghee and all",
    buttons:[
      {id: "ghee_prep", title: "ghee is prepared"},
      {id:"faq", title:"FAQs"},
      {id:"contact", title:"Contact Us"},
    ]
  };
  await sendMessage(userPhone, b2bMessage);
  const msg={
    text:"press to continue",
    buttons:[
      {id:"helpp", title:"continue"}
    ]
  }
  return await sendMessage(userPhone, msg);
  // Send button message for B2B interaction
 
};


exports.handleBuyGheePlanQuantity = async(userPhone,buttonId) => {
  if (buttonId === "plan_A2") {
    const quantityMessage = {
      text: "You selected A2 Cow Ghee! Please choose the quantity you'd like to purchase:",
      buttons: [
        {
          id: "small_planA2",
          title: "Small (500g)"
        },
        {
          id: "medium_planA2",
          title: "Medium (1kg)"
        },
        {
          id: "large_planA2",
          title: "Large (2kg)"
        },
      ]
    };
    const customOrderMessage = {
      text: "If you'd like to order a custom quantity, please choose this Option",
      buttons: [
        {
          id: "custom_planA2",
          title: "Custom Amount"
        },
      ]
    };


    // Send quantity options for A2 Ghee
    await sendMessage(userPhone, quantityMessage);
    return await sendMessage(userPhone, customOrderMessage);
    
  }

  // Handle buffalo selection
  if (buttonId === "plan_buffalo") {
    const quantityMessage = {
      text: "You selected Buffalo Ghee! Please choose the quantity you'd like to purchase:",
      buttons: [
        {
          id: "small_planbuffalo",
          title: "Small (500g)"
        },
        {
          id: "medium_planbuffalo",
          title: "Medium (1kg)"
        },
        {
          id: "large_planbuffalo",
          title: "Large (2kg)"
        }
      ],
      
    };
    const customOrderMessage = {
      text: "if you like to subscribe our monthly plan then click here",
      buttons: [
        {
          id: "custom_planbuffalo",
          title: "Custom Amount"
        },
      ]
    };


    // Send quantity options for Buffalo Ghee
    await sendMessage(userPhone, quantityMessage);
    return await sendMessage(userPhone, customOrderMessage);
  }
}