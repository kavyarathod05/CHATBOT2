// app.js (Main Application Entry Point)
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const scheduleSubscriptionReminders = require('./reminder/scheduler.js');
require('./config/db'); // Database connection

require('dotenv').config();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start cron jobs
scheduleSubscriptionReminders();

// Routes
const whatsappRoutes = require('./routes/whatsappRoutes');
const Routes = require('./routes/Routes.js')
app.use('/', whatsappRoutes); // Webhook for receiving WhatsApp messages
app.use("/",Routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
