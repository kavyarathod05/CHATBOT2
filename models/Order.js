const mongoose = require('mongoose');


const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderType:{type:String,required:true},
    quantity: { type: Number, required: true },
    deliveryDate: { type: Date, required: true },
    address: { type: String, required: true },
    status: { type: String, enum: ['pending', 'delivered', 'cancelled'], default: 'pending' },
    razorpayOrderId: { type: String, required: true }, // Razorpay order ID
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Order', orderSchema);
  