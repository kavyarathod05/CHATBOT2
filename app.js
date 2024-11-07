// app.js (Main Application Entry Point)
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
// require('./config/db'); // Database connection

require('dotenv').config();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
const whatsappRoutes = require('./routes/whatsappRoutes');
app.use('/webhook', whatsappRoutes); // Webhook for receiving WhatsApp messages

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
