const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;

const { swaggerUi, specs } = require('./swager');

// Import the cron job
const proxyConfigCron = require('./cron/proxyConfigCron');
require('./cron/eventPruneCron')

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DBNAME || 'proxy_gui', useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api', require('./routes/reverseProxyApi'));

const basicAuth = require('express-basic-auth');
let basicAuthMiddleware = (req,res,next)=>next()
if (process.env.AUTH_USER && process.env.AUTH_PASSWORD) {
    // Basic Authentication Middleware
    basicAuthMiddleware = basicAuth({
        users: { [process.env.AUTH_USER]: process.env.AUTH_PASSWORD },
        challenge: true,
        realm: 'Proxyflare',
    });
}

app.use('/api', require('./routes/reverseProxyApiPublic'));

// API route for events
const Event = require('./models/Event');
app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find().sort({ timestamp: -1 }).limit(50);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching events' });
    }
});

// API routes for cron job control
app.post('/api/cron/start', (req, res) => {
    proxyConfigCron.start();
    res.json({ status: 'running' });
});

app.post('/api/cron/stop', (req, res) => {
    proxyConfigCron.stop();
    res.json({ status: 'stopped' });
});

app.get('/api/cron/status', (req, res) => {
    res.json({ status: proxyConfigCron.status });
});



app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api-docs',basicAuthMiddleware, swaggerUi.serve, swaggerUi.setup(specs));
app.use('/api/internal',basicAuthMiddleware, require('./routes/apiKeyRoutes'));
app.use('/',basicAuthMiddleware, require('./routes/reverseProxy'));

// Start the cron job
//proxyConfigCron.start();

app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    proxyConfigCron.stop();
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});