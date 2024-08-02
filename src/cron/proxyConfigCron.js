const cron = require('node-cron');
const { logEvent } = require('../utils/logger');
const { createOrUpdateDnsRecord,createOrUpdateProxyHost } = require('../utils/proxy-dns-apis')
const ReverseProxy = require('../models/ReverseProxy');

let isConfiguring = false

async function configureProxies(domains = []) {

    if (isConfiguring) {
        console.log('Proxy configuration is already in progress. Skipping this run.');
        return;
    }

    isConfiguring = true;

    try {


        try {

            let query = {
                $or: [
                    { dnsStatus: { $eq: false } },
                    { proxyStatus: { $eq: false } }
                ]
            };
            
            if (domains.length > 0) {
                query.domains = { $in: domains };
            }

            let proxies = await ReverseProxy.find(query)
            if (proxies.length > 0) {
                console.log('Configuring proxies (DNS)...');
                await Promise.all(proxies.map(async p => {
                    await Promise.all(p.domains.map(d => {
                        return createOrUpdateDnsRecord(d)
                    }))
                    p.dnsStatus = true
                    return p.save()
                }))
                await logEvent('CONFIGURE_PROXIES_DNS_SUCCESS', { timestamp: new Date(), proxies });
            } else {
                console.log('No proxies dns config needed')
                await logEvent('CONFIGURE_PROXIES_DNS_WAITING', { timestamp: new Date(), proxies });
            }
        } catch (err) {
            await logEvent('CONFIGURE_PROXIES_DNS_FAIL', { timestamp: new Date(), err: err.isAxiosError ? err.response.data : err.stack });
        }

        try {
            let proxies = await ReverseProxy.find({ $or: [{ proxyStatus: { $eq: false } }, { proxyStatus: { $exists: false } }] })
            if (proxies.length > 0) {
                console.log('Configuring proxies (nginx reverse proxy)...');
                await Promise.all(proxies.map(async p => {
                    await createOrUpdateProxyHost(p.domains,p.proxyHost,p.proxyPort,p.proxyProtocol, {advancedConfig:p.advancedConfig})
                    p.proxyStatus = true
                    return p.save()
                }))
                await logEvent('CONFIGURE_PROXIES_NGINX_PROXY_HOST_SUCCESS', { timestamp: new Date(), proxies });
            } else {
                console.log('No proxies dns config needed')
                await logEvent('CONFIGURE_PROXIES_NGINX_PROXY_HOST_WAITING', { timestamp: new Date(), proxies });
            }
        } catch (err) {
            await logEvent('CONFIGURE_PROXIES_NGINX_PROXY_HOST_FAIL', { timestamp: new Date(), err: err.isAxios ? err.response.data : err.stack });
        }

        //console.log('Proxies configured successfully');
        //await logEvent('CONFIGURE_PROXIES_SUCCESS', { timestamp: new Date() });
    } catch (error) {
        console.error('Error configuring proxies:', error);
        await logEvent('CONFIGURE_PROXIES_FAIL', { error: error.message, timestamp: new Date() });
    }finally{
        isConfiguring=false
    }
}

// Schedule the cron job to run every 10 seconds
const job = cron.schedule('*/10 * * * * *', async () => {
    console.log('Running proxy configuration cron job');
    await configureProxies();
},{
    scheduled:false
});

let scope 
module.exports = scope = {
    status:'stopped',
    start: () => {
        job.start()
        scope.status='running'
    },
    stop: () => {
        job.stop()
        scope.status='stopped'
    }
};