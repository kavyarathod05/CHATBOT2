const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  phone: { type: String, required: true, unique: false },
  address: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  subscriptionStartDate:{type:Date , default: Date.now()}
});

module.exports = mongoose.model('User', userSchema);
