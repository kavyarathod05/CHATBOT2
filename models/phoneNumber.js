// models/PhoneNumber.js
const mongoose = require('mongoose');

// Define the PhoneNumber schema
const phoneNumber= new mongoose.Schema({
  userPhone: { type: String, required:true, ref:'User' }, 
  isMessageSent: { type: Boolean, default: false },  // New field to track if message is sent

});

module.exports = mongoose.model('PhoneNumber', phoneNumber);
