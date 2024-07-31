const ApiKey = require('../models/ApiKey');

const authMiddleware = async (req, res, next) => {
    try {
        // Get the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No Authorization header provided' });
        }

        // Check if it's a Bearer token
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ error: 'Invalid Authorization header format' });
        }

        const token = parts[1];

        // Check if the API key exists in the database
        const apiKey = await ApiKey.findOne({ key: token });

        if (!apiKey) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        // If we reach here, the API key is valid
        // You can attach the API key or any other information to the request object if needed
        req.apiKey = apiKey;

        next();
    } catch (error) {
        console.error('Error in auth middleware:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = authMiddleware;
