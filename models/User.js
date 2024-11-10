const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: { type: String},
    name: String,
    email: String,
    subscriptionStatus: { type: String, default: 'inactive' },
    subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },  // Link to Subscription
    lastInteraction: { type: Date, default: Date.now },
    address: String,
    paymentMethod: String, // e.g., "razorpay"
    subscriptionStartDate: { type: Date },
});

module.exports = mongoose.model('User', userSchema);
