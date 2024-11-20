const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  phone: { type: String, required: false, unique: false },
  address: { type: String, required: false },
  userOrderQuantity: { type: String, required: false },
  userOrderPaymentID: { type: String, required: false },
  userPaymentStatus:{type:Boolean,default:false},
  subscription: { type: Boolean, default : false},
  subscriptionType: { type: String, required: false },
  subscriptionQuantity: { type: String, required: false },
  subscriptionAmount: {type:String ,required:false},
  userAddress: { type: String, required: false },
  customerID: { type: String, required: false },
  subscriptionId: { type: String, required: false },
  subscriptionStartDate:{type:Date , default: Date.now()},
  planId:{type:String, required:false},
  deliveryDate:{type:Date,default:Date.now()},
  nextReminderDate:{type:Date , default: Date.now()},
  
});

module.exports = mongoose.model('User', userSchema);