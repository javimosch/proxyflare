const express = require('express');
const router = express.Router();
const ReverseProxy = require('../models/ReverseProxy');
const { logEvent } = require('../utils/logger');


router.get('/', async (req, res) => {
  try {
    const proxies = await ReverseProxy.find();
    await logEvent('LIST_PROXIES_SUCCESS', { count: proxies.length });
    res.render('app',{proxies,nginxProxyManagerURL:process.env.nginxProxyManagerHost});
  } catch (error) {
    await logEvent('LIST_PROXIES_FAIL', { error: error.message });
    res.status(500).render('error', { error: 'Failed to retrieve proxies' });
  }
});

// Create new reverse proxy form
router.get('/new', (req, res) => {
  res.render('new',{proxy:{}});
});

// Create new reverse proxy
router.post('/', async (req, res) => {
  try {
    const { domains, proxyHost, proxyPort, proxyProtocol } = req.body;
    const newProxy = new ReverseProxy({
      domains: domains.split(',').map(domain => domain.trim()),
      proxyHost,
      proxyPort,
      proxyProtocol
    });
    await newProxy.save();
    await logEvent('CREATE_PROXY_SUCCESS', { id: newProxy._id, domains: newProxy.domains });
    res.redirect('/');
  } catch (error) {
    await logEvent('CREATE_PROXY_FAIL', { error: error.message, data: req.body });
    res.status(400).render('new', { error: 'Failed to create proxy', formData: req.body });
  }
});

// Edit reverse proxy form
router.get('/edit/:id', async (req, res) => {
  try {
    const proxy = await ReverseProxy.findById(req.params.id);
    if (!proxy) {
      await logEvent('EDIT_PROXY_FORM_FAIL', { error: 'Proxy not found', id: req.params.id });
      return res.status(404).render('error', { error: 'Proxy not found' });
    }
    res.render('edit', { proxy });
  } catch (error) {
    await logEvent('EDIT_PROXY_FORM_FAIL', { error: error.message, id: req.params.id });
    res.status(500).render('error', { error: 'Failed to retrieve proxy for editing' });
  }
});

// Update reverse proxy
router.post('/edit/:id', async (req, res) => {
  try {
    const { domains, proxyHost, proxyPort, proxyProtocol, proxyStatus, dnsStatus } = req.body;
    const updatedProxy = await ReverseProxy.findByIdAndUpdate(req.params.id, {
      domains: domains.split(',').map(domain => domain.trim()),
      proxyHost,
      proxyPort,
      proxyProtocol,
      proxyStatus: !!proxyStatus,
      dnsStatus: !!dnsStatus
    }, { new: true });
    
    if (!updatedProxy) {
      await logEvent('UPDATE_PROXY_FAIL', { error: 'Proxy not found', id: req.params.id });
      return res.status(404).render('error', { error: 'Proxy not found' });
    }
    
    await logEvent('UPDATE_PROXY_SUCCESS', { id: updatedProxy._id, domains: updatedProxy.domains });
    res.redirect('/');
  } catch (error) {
    await logEvent('UPDATE_PROXY_FAIL', { error: error.message, id: req.params.id, data: req.body });
    res.status(400).render('proxyForm', { error: 'Failed to update proxy', proxy: { ...req.body, _id: req.params.id } });
  }
});

// Delete reverse proxy
router.post('/delete/:id', async (req, res) => {
  try {
    const deletedProxy = await ReverseProxy.findByIdAndDelete(req.params.id);
    if (!deletedProxy) {
      await logEvent('DELETE_PROXY_FAIL', { error: 'Proxy not found', id: req.params.id });
      return res.status(404).render('error', { error: 'Proxy not found' });
    }
    await logEvent('DELETE_PROXY_SUCCESS', { id: deletedProxy._id, domains: deletedProxy.domains });
    res.redirect('/');
  } catch (error) {
    await logEvent('DELETE_PROXY_FAIL', { error: error.message, id: req.params.id });
    res.status(500).render('error', { error: 'Failed to delete proxy' });
  }
});

module.exports = router;