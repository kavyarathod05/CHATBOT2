const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI; // Make sure you have MONGO_URI in .env file

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
  })
  .catch((error) => {
  });

module.exports = mongoose.connection;
