require('dotenv').config();
const { init } = require('./services/QueueService');

console.log('[WORKER] Starting Standalone Worker...');
init();