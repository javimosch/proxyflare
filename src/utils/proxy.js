const ReverseProxy = require('../models/ReverseProxy');
const { createOrUpdateDnsRecord,createOrUpdateProxyHost } = require('./proxy-dns-apis')
const { logEvent } = require('./logger');

async function configureReverseProxyNginxDns(reverseProxyId) {
    try {
        const proxy = await ReverseProxy.findById(reverseProxyId);
        
        if (!proxy) {
            throw new Error(`Reverse proxy with ID ${reverseProxyId} not found`);
        }

        console.log(`Configuring proxy for domains: ${proxy.domains.join(', ')}`);

        // DNS configuration
        if (!proxy.dnsStatus) {
            try {
                for (let domain of proxy.domains) {
                    await createOrUpdateDnsRecord(domain);
                }
                proxy.dnsStatus = true;
                console.log(`DNS configured for ${proxy.domains.join(', ')}`);
            } catch (error) {
                console.error(`Error configuring DNS for ${proxy.domains.join(', ')}:`, error);
                throw error; // Re-throw to be caught in the outer try-catch
            }
        }

        // Nginx Proxy Manager configuration
        if (!proxy.proxyStatus) {
            try {
                await createOrUpdateProxyHost(proxy.domains, proxy.proxyHost, proxy.proxyPort, proxy.proxyProtocol);
                proxy.proxyStatus = true;
                console.log(`Proxy configured for ${proxy.domains.join(', ')}`);
            } catch (error) {
                console.error(`Error configuring proxy for ${proxy.domains.join(', ')}:`, error);
                throw error; // Re-throw to be caught in the outer try-catch
            }
        }

        // Save the updated proxy status
        await proxy.save();

        await logEvent('CONFIGURE_REVERSE_PROXY_SUCCESS', { 
            reverseProxyId, 
            domains: proxy.domains,
            timestamp: new Date() 
        });

        return proxy;
    } catch (error) {
        console.error(`Error configuring reverse proxy ${reverseProxyId}:`, error);
        await logEvent('CONFIGURE_REVERSE_PROXY_FAIL', { 
            reverseProxyId, 
            error: error.message, 
            timestamp: new Date() 
        });
        throw error; // Re-throw the error for the caller to handle
    }
}

module.exports = {
    configureReverseProxyNginxDns
};