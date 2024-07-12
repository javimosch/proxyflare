const cron = require('node-cron');
const Event = require('../models/Event');
const { logEvent } = require('../utils/logger');

let isRunning = false;

async function pruneOldEvents() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await Event.deleteMany({ timestamp: { $lt: oneDayAgo } });
      console.log(`Pruned ${result.deletedCount} old events`);
      await logEvent('PRUNE_EVENTS_SUCCESS', { deletedCount: result.deletedCount });
    } catch (error) {
      console.error('Error pruning old events:', error);
      await logEvent('PRUNE_EVENTS_FAIL', { error: error.message });
    }
  }
  
  const job = cron.schedule('0 0 */12 * * *', async () => {
    console.log('Running event prune cron job');
    isRunning = true;
    await pruneOldEvents();
  }, {
    scheduled:true
  });

module.exports = {
    start: () => {
        job.start();
        isRunning = true;
    },
    stop: () => {
        job.stop();
        isRunning = false;
    },
    status: () => isRunning
};