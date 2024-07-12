const Event = require('../models/Event');

async function logEvent(action, details) {
  try {
    const event = new Event({
      action,
      details
    });
    await event.save();
    console.log(`Event logged: ${action}`);
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

module.exports = { logEvent };