const mongoose = require('mongoose');
const DEFAULT_UPSTREAM_HOST = process.env.nginxProxyManagerDefaultUpstreamHost

const reverseProxySchema = new mongoose.Schema({
  domains: [String],
  proxyHost: {
    type:String,
    default:DEFAULT_UPSTREAM_HOST||""
  },
  proxyPort: Number,
  proxyProtocol: {
    type: String,
    default: 'http'
  },
  proxyStatus: {
    type: Boolean,
    default: false
  },
  dnsStatus: {
    type: Boolean,
    default: false
  },
  advancedConfig: {
    type: String
  },
}, { timestamps: true });

module.exports = mongoose.model('ReverseProxy', reverseProxySchema);