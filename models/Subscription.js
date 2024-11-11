const mongoose = require('mongoose');


const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionType: { type: String, enum: ['monthly', 'weekly'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  });
  
  module.exports = mongoose.model('Subscription', subscriptionSchema);
  