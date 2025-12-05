// backend/utils/logger.js
// New File

/**
 * Simple atomic logger for standardized, filterable console output.
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

// Set the current log level (e.g., from process.env)
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

/**
 * Main log function.
 * @param {string} level - e.g., 'INFO', 'ERROR'
 * @param {string} service - The name of the file/service (e.g., 'RAGPipeline')
 * @param {string} message - The log message
 * @param {object} [context] - Optional context object
 */
function log(level, service, message, context = null) {
    const levelNum = LOG_LEVELS[level];
    if (levelNum === undefined || levelNum < CURRENT_LEVEL) {
        return; // Skip logging if below current level
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] [${service}] - ${message}`;

    const logMethod = console[level.toLowerCase()] || console.log;

    if (context) {
        logMethod(formattedMessage, context);
    } else {
        logMethod(formattedMessage);
    }
}

module.exports = {
    debug: (service, message, context) => log('DEBUG', service, message, context),
    info: (service, message, context) => log('INFO', service, message, context),
    warn: (service, message, context) => log('WARN', service, message, context),
    error: (service, message, context) => log('ERROR', service, message, context),
};