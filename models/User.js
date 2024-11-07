const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userPhone: { type: Number},  // Set userPhone as Number
    name: { type: String },
    group: { type: String },
    buttonId: { type: String },
    gheeType: { type: String },
    nextOrderDate: { type: Date },
    paymentStatus: { type: String },
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
});

const User = mongoose.model('User', userSchema);
module.exports = User;
