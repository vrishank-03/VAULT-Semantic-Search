// backend/services/FormattingService.js
// New File

const logger = require('../utils/logger');
const SERVICE_NAME = 'FormattingService';

/**
 * Formats the raw LLM answer for the frontend.
 * @param {string} rawAnswer - The raw text from GenerationService.
 *s @param {Array<object>} sources - The list of final relevant sources.
 * @returns {Promise<{answer: string, sources: Array<object>}>} - The final formatted payload.
 */
async function formatAnswer(rawAnswer, sources) {
    logger.info(SERVICE_NAME, 'Formatting final answer...');
    
    //
    // --- FUTURE OPTIMIZATION ---
    // This is where we would add robust post-processing.
    // e.g., Check if the answer *actually* follows the Markdown rules.
    // If not, parse it and re-format it.
    // For now, we trust the LLM's prompt.
    //
    
    const formattedPayload = {
        answer: rawAnswer, // Pass-through for now
        sources: sources
    };

    logger.debug(SERVICE_NAME, 'Formatting complete.', formattedPayload);
    return formattedPayload;
}

module.exports = {
    formatAnswer,
};