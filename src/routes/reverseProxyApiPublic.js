const express = require('express');
const router = express.Router();
const ReverseProxy = require('../models/ReverseProxy');
const { configureReverseProxyNginxDns } = require('../utils/proxy');
const { logEvent } = require('../utils/logger');

const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     ReverseProxy:
 *       type: object
 *       required:
 *         - domains
 *         - proxyHost
 *         - proxyPort
 *         - proxyProtocol
 *       properties:
 *         domains:
 *           type: array
 *           items:
 *             type: string
 *           description: List of domains
 *         proxyHost:
 *           type: string
 *           description: Upstream host
 *         proxyPort:
 *           type: integer
 *           description: Upstream port
 *         proxyProtocol:
 *           type: string
 *           description: Upstream protocol
 *         dnsStatus:
 *           type: boolean
 *           description: DNS configuration status
 *         proxyStatus:
 *           type: boolean
 *           description: Proxy configuration status
 *       example:
 *         domains: ["example.com", "www.example.com"]
 *         proxyHost: "backend-service"
 *         proxyPort: 8080
 *         proxyProtocol: "http"
 */

/**
 * @swagger
 * /proxies:
 *   get:
 *     summary: Retrieve a list of all reverse proxies
 *     tags: [ReverseProxy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A list of reverse proxies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ReverseProxy'
 *       500:
 *         description: Server error
 */
router.get('/proxies', async (req, res) => {
    try {
        const proxies = await ReverseProxy.find();
        res.json(proxies);
    } catch (error) {
        console.error('Error fetching proxies:', error);
        res.status(500).json({ error: 'An error occurred while fetching proxies' });
    }
});

module.exports = router;
