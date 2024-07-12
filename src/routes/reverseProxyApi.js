const express = require('express');
const router = express.Router();
const ReverseProxy = require('../models/ReverseProxy');
const { configureReverseProxyNginxDns } = require('../utils/proxy');
const { logEvent } = require('../utils/logger');

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
 *         dnsStatus: false
 *         proxyStatus: false
 */

/**
 * @swagger
 * /proxies:
 *   get:
 *     summary: Retrieve a list of all reverse proxies
 *     tags: [ReverseProxy]
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
        await logEvent('API_LIST_PROXIES_SUCCESS', { count: proxies.length });
    } catch (error) {
        console.error('Error fetching proxies:', error);
        res.status(500).json({ error: 'An error occurred while fetching proxies' });
    }
});

/**
 * @swagger
 * /reverse-proxy:
 *   post:
 *     summary: Create or update a reverse proxy
 *     tags: [ReverseProxy]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReverseProxy'
 *     responses:
 *       201:
 *         description: Reverse proxy created or updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReverseProxy'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/reverse-proxy', async (req, res) => {
    try {
        const { domains, proxyHost, proxyPort, proxyProtocol } = req.body;

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({ error: 'Domains must be a non-empty array' });
        }

        let proxy = await ReverseProxy.findOne({ domains: { $in: domains } });

        if (proxy) {
            // Update existing proxy
            proxy.domains = domains;
            proxy.proxyHost = proxyHost;
            proxy.proxyPort = proxyPort;
            proxy.proxyProtocol = proxyProtocol;
            proxy.dnsStatus = false;
            proxy.proxyStatus = false;
        } else {
            // Create new proxy
            proxy = new ReverseProxy({
                domains,
                proxyHost,
                proxyPort,
                proxyProtocol,
                dnsStatus: false,
                proxyStatus: false
            });
        }

        await proxy.save();

        // Configure the proxy immediately
        await configureReverseProxyNginxDns(proxy._id);

        res.status(201).json(proxy);
        await logEvent('REVERSE_PROXY_CREATED_OR_UPDATED', { domains, proxyHost, proxyPort, proxyProtocol });
    } catch (error) {
        console.error('Error creating/updating reverse proxy:', error);
        res.status(500).json({ error: 'Failed to create/update reverse proxy' });
        await logEvent('REVERSE_PROXY_CREATE_OR_UPDATE_FAIL', { error: error.message });
    }
});

/**
 * @swagger
 * /reverse-proxy/{domain}:
 *   delete:
 *     summary: Delete a reverse proxy
 *     tags: [ReverseProxy]
 *     parameters:
 *       - in: path
 *         name: domain
 *         schema:
 *           type: string
 *         required: true
 *         description: Domain of the reverse proxy to delete
 *     responses:
 *       200:
 *         description: Reverse proxy deleted successfully
 *       404:
 *         description: Reverse proxy not found
 *       500:
 *         description: Server error
 */
router.delete('/reverse-proxy/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const proxy = await ReverseProxy.findOneAndDelete({ domains: domain });

        if (!proxy) {
            return res.status(404).json({ error: 'Reverse proxy not found' });
        }

        res.json({ message: 'Reverse proxy deleted successfully' });
        await logEvent('REVERSE_PROXY_DELETED', { domain });
    } catch (error) {
        console.error('Error deleting reverse proxy:', error);
        res.status(500).json({ error: 'Failed to delete reverse proxy' });
        await logEvent('REVERSE_PROXY_DELETE_FAIL', { error: error.message });
    }
});

module.exports = router;