const mongoose = require('mongoose');


const paymentSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    razorpayPaymentId: { type: String, required: true }, // Payment ID from Razorpay
    razorpayOrderId: { type: String, required: true },   // Order ID from Razorpay
    razorpaySignature: { type: String, required: true }, // Signature from Razorpay for verification
    createdAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model('Payment', paymentSchema);
  