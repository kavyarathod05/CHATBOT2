const mongoose = require('mongoose');
const { PlaybackGrant } = require('twilio/lib/jwt/AccessToken');

const subscriptionSchema = new mongoose.Schema({
    plan : { type: String},
    quantity:{type:String}
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
