// backend/ml_runner.js - ENTERPRISE ADAPTER

const axios = require('axios'); 
const logger = require('./utils/logger');

const SERVICE_NAME = 'MLRunner';
const EMBEDDER_API_URL = 'http://127.0.0.1:8001/embed';

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
    // We use the '.content' field mandated by the new documentProcessor.js
    const textPayload = chunks.map(c => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object') {
             return c.content || ""; // Safe fallback
        }
        return "";
    });

    // 2. Validate Payload size (Optional safety check)
    const validCount = textPayload.filter(t => t.length > 0).length;
    logger.info(SERVICE_NAME, `Sending ${textPayload.length} items (${validCount} non-empty) to embedder API...`);

    try {
        // 3. Send only the text to the Python API
        const response = await axios.post(EMBEDDER_API_URL, {
            chunks: textPayload 
        });
        
        // 4. Validate Response
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
 * Gets a single embedding for a query string.
 * @param {string} query - The query text.
 * @returns {Promise<number[]>} A promise that resolves to a single embedding.
 */
async function getEmbeddingForQuery(query) {
    // Wrap single string in array, get result, return first element
    const embeddings = await getEmbeddings([query]);
    if (!embeddings || embeddings.length === 0) {
        throw new Error('Failed to generate embedding for query.');
    }
    return embeddings[0];
}

module.exports = { getEmbeddings, getEmbeddingForQuery };