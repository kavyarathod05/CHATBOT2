// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: String,
    name: String,
    group: String,
    subscriptionPlan: String,
    nextOrderDate: Date,
    paymentStatus: String,
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
});

module.exports = mongoose.model('User', userSchema);
