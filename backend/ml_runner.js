// backend/ml_runner.js - ENTERPRISE ADAPTER & COMPATIBILITY LAYER
// --------------------------------------------------------
// [ROLE] Bridges Node.js to Python AI Services (Port 8001).
// [ADAPTER] Includes 'spawnPythonWorker' shim for backward compatibility
//           with searchService.js logic.
// --------------------------------------------------------

const axios = require('axios');
const logger = require('./utils/logger');

const SERVICE_NAME = 'MLRunner';
const EMBEDDER_API_URL = process.env.EMBEDDER_API_URL || 'http://127.0.0.1:8001/embed';

/**
 * [ENTERPRISE] Gets embeddings by calling the high-speed embedder API.
 * Automatically handles both Array<String> and Array<Object>.
 * @param {Array<string|object>} chunks - An array of text strings OR chunk objects.
 * @returns {Promise<number[][]>} A promise that resolves to an array of vector embeddings.
 */
async function getEmbeddings(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        logger.warn(SERVICE_NAME, 'getEmbeddings called with empty/invalid array.');
        return [];
    }

    // 1. [ADAPTER] Extract text if input is objects (Standardized pipeline)
    const textPayload = chunks.map(c => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object') {
            return c.content || ""; // Safe fallback
        }
        return "";
    });

    const validCount = textPayload.filter(t => t.length > 0).length;
    logger.info(SERVICE_NAME, `Sending ${textPayload.length} items (${validCount} non-empty) to embedder API...`);

    try {
        const response = await axios.post(EMBEDDER_API_URL, {
            chunks: textPayload
        });

        const embeddings = response.data.embeddings;
        if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
            logger.error(SERVICE_NAME, `[MISMATCH] Sent ${chunks.length} items, but API returned ${embeddings?.length} embeddings.`);
            throw new Error('Embedding count mismatch.');
        }

        logger.info(SERVICE_NAME, `Received ${embeddings.length} embeddings from API.`);
        return embeddings;

    } catch (error) {
        logger.error(SERVICE_NAME, 'Error calling embedder API:', error.message);

        if (error.code === 'ECONNREFUSED') {
            logger.error(SERVICE_NAME, 'FATAL: Cannot connect to embedder service (Port 8001). Is python embedder.py running?');
            throw new Error('Embedding service is offline.');
        }
        throw new Error(`Embedding API error: ${error.message}`);
    }
}

/**
 * [COMPATIBILITY SHIM] 
 * The new searchService.js uses 'spawnPythonWorker' to request query embeddings.
 * This adapter intercepts that call and routes it to our HTTP API instead.
 */
async function spawnPythonWorker(scriptName, method, args) {
    // Intercept 'embed_query' calls intended for embedder.py
    if (scriptName.includes('embedder') && method === 'embed_query') {
        try {
            const queryText = args.query;
            const embeddings = await getEmbeddings([queryText]);
            // Return format expected by searchService
            return { embedding: embeddings[0] };
        } catch (err) {
            logger.error(SERVICE_NAME, '[SHIM] Failed to process embed_query via API adapter.', err);
            throw err;
        }
    }

    // Fallback error for unknown scripts
    throw new Error(`[ML_RUNNER] Script '${scriptName}' with method '${method}' is not supported in HTTP mode.`);
}

/**
 * Gets a single embedding for a query string.
 * @param {string} query - The query text.
 * @returns {Promise<number[]>} A promise that resolves to a single embedding.
 */
async function getEmbeddingForQuery(query) {
    const embeddings = await getEmbeddings([query]);
    if (!embeddings || embeddings.length === 0) {
        throw new Error('Failed to generate embedding for query.');
    }
    return embeddings[0];
}

module.exports = {
    getEmbeddings,
    getEmbeddingForQuery,
    spawnPythonWorker
};