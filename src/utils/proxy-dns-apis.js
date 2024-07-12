const axios = require('axios');
const NGINX_USERNAME = process.env.nginxProxyManagerUsername;
const NGINX_PASSWORD = process.env.nginxProxyManagerPassword;
const LETENCRYPT_EMAILS = (process.env.letsEncryptContactEmails || '').split(',').filter(str => !!str);
const NGINX_PROXY_MANAGER_HOST = process.env.nginxProxyManagerHost || 'http://localhost:81'
const CLOUDFLARE_API_URL = process.env.CLOUDFLARE_API_URL || 'https://api.cloudflare.com'
const DEFAULT_UPSTREAM_HOST = process.env.nginxProxyManagerDefaultUpstreamHost



let scope;
module.exports = scope = {
  async getToken(identity = NGINX_USERNAME, secret = NGINX_PASSWORD) {
    try {
      const response = await axios.post(`${NGINX_PROXY_MANAGER_HOST}/api/tokens`, {
        identity,
        secret
      });
      return response.data;
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  },

  async createOrUpdateProxyHost(domains, upstreamHost = DEFAULT_UPSTREAM_HOST, port = 3000, scheme = 'http', options = {}) {
    let {
      letsEncryptContactEmails = LETENCRYPT_EMAILS,
      letsEncryptContactEmail = LETENCRYPT_EMAILS[0],
      accessToken = null,
      forceSSL = true,
      http2Support = true,
      advancedConfig = '',
      blockExploits = true,
      cacheEnabled = false,
      allowWebsocketUpgrade = false
    } = options;
  
    if (!Array.isArray(domains)) {
      domains = [domains]; // Convert single domain to array
    }
  
    if (!accessToken) {
      accessToken = (await scope.getToken()).token;
    }
  
    if (letsEncryptContactEmails.length === 0) {
      throw new Error('letsEncryptContactEmails required (array of strings)');
    }

    if (!letsEncryptContactEmail || !letsEncryptContactEmail.includes('@')) {
      throw new Error('Valid letsEncryptContactEmail is required');
    }
  
    try {
      // Step 1: Check if proxy host already exists
      const existingProxyHosts = await axios.get(`${NGINX_PROXY_MANAGER_HOST}/api/nginx/proxy-hosts`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
  
      let proxyHost = existingProxyHosts.data.find(host => 
        host.domain_names.some(domain => domains.includes(domain))
      );
  
      let proxyHostId;
      if (proxyHost) {
        // Update existing proxy host
        proxyHostId = proxyHost.id;
        await axios.put(`${NGINX_PROXY_MANAGER_HOST}/api/nginx/proxy-hosts/${proxyHostId}`, {
          domain_names: domains,
          forward_scheme: scheme,
          forward_host: upstreamHost,
          forward_port: port,
          access_list_id: '0',
          ssl_forced: forceSSL,
          http2_support: http2Support,
          meta: {
            letsencrypt_agree: true,
            dns_challenge: false
          },
          advanced_config: advancedConfig,
          block_exploits: blockExploits,
          caching_enabled: cacheEnabled,
          allow_websocket_upgrade: allowWebsocketUpgrade,
          hsts_enabled: false,
          hsts_subdomains: false
        }, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } else {
        // Create new proxy host
        const createResponse = await axios.post(`${NGINX_PROXY_MANAGER_HOST}/api/nginx/proxy-hosts`, {
          domain_names: domains,
          forward_scheme: scheme,
          forward_host: upstreamHost,
          forward_port: port,
          access_list_id: '0',
          certificate_id: null,
          ssl_forced: forceSSL,
          http2_support: http2Support,
          meta: {
            letsencrypt_agree: true,
            dns_challenge: false
          },
          advanced_config: advancedConfig,
          block_exploits: blockExploits,
          caching_enabled: cacheEnabled,
          allow_websocket_upgrade: allowWebsocketUpgrade,
          hsts_enabled: false,
          hsts_subdomains: false
        }, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        proxyHostId = createResponse.data.id;
      }
  
      // Step 2: Check if SSL certificate exists, if not create one
      const existingCertificates = await axios.get(`${NGINX_PROXY_MANAGER_HOST}/api/nginx/certificates`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
  
      let certificate = existingCertificates.data.find(cert => 
        cert.domain_names.some(domain => domains.includes(domain))
      );
  
      let certificateId;
      if (!certificate) {
        console.log({
          letsencrypt_email: letsEncryptContactEmail
        })
        const sslResponse = await axios.post(`${NGINX_PROXY_MANAGER_HOST}/api/nginx/certificates`, {
          domain_names: domains,
          meta: {
            letsencrypt_agree: true,
            letsencrypt_email: letsEncryptContactEmail,
            dns_challenge: false
          },
          provider: 'letsencrypt' 
        }, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        certificateId = sslResponse.data.id;
      } else {
        certificateId = certificate.id;
      }
  
      // Step 3: Apply the SSL certificate to the proxy host
      const updateResponse = await axios.put(`${NGINX_PROXY_MANAGER_HOST}/api/nginx/proxy-hosts/${proxyHostId}`, {
        certificate_id: certificateId,
        ssl_forced: forceSSL,
        http2_support: http2Support
      }, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
  
      return updateResponse.data;
    } catch (error) {
      console.error('Error creating or updating proxy host with SSL:', error.response ? error.response.data : error.message);
      throw error;
    }
  },

  async createOrUpdateDnsRecord(name, content = process.env.cloudflareDefaultARecordValue, zoneName = "", type = 'A', proxied = false, ttl = 3600, cloudflareApiToken = process.env.cloudflareApiToken) {
    // Parse the zoneNameToIdMap from the environment variable
    let zoneNameToIdMap = {};
    try {
        zoneNameToIdMap = JSON.parse(process.env.CLOUDFLARE_ZONE_NAME_TO_ID_MAP || '{}');
    } catch (error) {
        console.error('Error parsing CLOUDFLARE_ZONE_NAME_TO_ID_MAP:', error);
        throw new Error('Invalid CLOUDFLARE_ZONE_NAME_TO_ID_MAP format');
    }

    if (zoneName === "") {
      for (let currZoneName in zoneNameToIdMap) {
        if (name.includes(currZoneName)) {
          zoneName = currZoneName;
          break;
        }
      }
    }

    if (!zoneName) {
      throw new Error('zoneName required');
    }

    const zoneId = zoneNameToIdMap[zoneName];
    if (!zoneId) {
      throw new Error(`Zone not found: ${zoneName}`);
    }

    if (!cloudflareApiToken) {
      throw new Error('cloudflareApiToken required');
    }

    try {
      // First, check if the record already exists
      const existingRecordsResponse = await axios.get(`${CLOUDFLARE_API_URL}/client/v4/zones/${zoneId}/dns_records`, {
        params: { type, name },
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const existingRecords = existingRecordsResponse.data.result;

      if (existingRecords && existingRecords.length > 0) {
        // If the record exists, update it
        const existingRecord = existingRecords[0];
        const updateResponse = await axios.put(`${CLOUDFLARE_API_URL}/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`, {
          type,
          name,
          content,
          ttl,
          proxied
        }, {
          headers: {
            'Authorization': `Bearer ${cloudflareApiToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('DNS record updated successfully');
        return updateResponse.data;
      } else {
        // If the record doesn't exist, create a new one
        const createResponse = await axios.post(`${CLOUDFLARE_API_URL}/client/v4/zones/${zoneId}/dns_records`, {
          type,
          name,
          content,
          ttl,
          proxied
        }, {
          headers: {
            'Authorization': `Bearer ${cloudflareApiToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('DNS record created successfully');
        return createResponse.data;
      }
    } catch (error) {
      console.error('Error creating or updating DNS record:', error.response ? error.response.data : error.message);
      throw error;
    }
  },

  async getZones(cloudflareApiToken) {
    try {
      const response = await axios.get('${CLOUDFLARE_API_URL}/client/v4/zones', {
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting zones:', error);
      throw error;
    }
  }
};