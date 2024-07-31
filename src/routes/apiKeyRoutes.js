const express = require('express');
const router = express.Router();
const ApiKey = require('../models/ApiKey');
const { logEvent } = require('../utils/logger');
const crypto = require('crypto');

// Helper function to generate API key
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Get all API keys
router.get('/api-keys', async (req, res) => {
  try {
    const apiKeys = await ApiKey.find({}, '-__v');
    res.json(apiKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create a new API key
router.post('/api-key', async (req, res) => {
  try {
    const { description } = req.body;
    const key = generateApiKey();
    const apiKey = new ApiKey({ key, description });
    await apiKey.save();
    res.status(201).json(apiKey);
    await logEvent('API_KEY_CREATED', { key, description });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
    await logEvent('API_KEY_CREATE_FAIL', { error: error.message });
  }
});

// Update (re-generate) an API key
router.put('/api-key/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const key = generateApiKey();
    const apiKey = await ApiKey.findByIdAndUpdate(id, { key, description }, { new: true });
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    res.json(apiKey);
    await logEvent('API_KEY_UPDATED', { id, key, description });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
    await logEvent('API_KEY_UPDATE_FAIL', { error: error.message });
  }
});

// Delete an API key
router.delete('/api-key/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = await ApiKey.findByIdAndDelete(id);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    res.json({ message: 'API key deleted successfully' });
    await logEvent('API_KEY_DELETED', { id });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
    await logEvent('API_KEY_DELETE_FAIL', { error: error.message });
  }
});

module.exports = router;
