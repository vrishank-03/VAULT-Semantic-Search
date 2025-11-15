// backend/ml_runner.js

const axios = require('axios'); // Requires 'npm install axios'
const logger = require('./utils/logger');

const SERVICE_NAME = 'MLRunner';
// This is the address of your new Python server
const EMBEDDER_API_URL = 'http://127.0.0.1:8001/embed';

/**
 * [REFACTORED] Gets embeddings by calling the high-speed embedder API.
 * @param {string[]} chunks - An array of text chunks.
 * @returns {Promise<number[][]>} A promise that resolves to an array of embeddings.
 */
async function getEmbeddings(chunks) {
    logger.info(SERVICE_NAME, `Sending ${chunks.length} chunks to embedder API...`);
    try {
        // Send the POST request to the FastAPI server
        const response = await axios.post(EMBEDDER_API_URL, {
            chunks: chunks 
        });
        
        logger.info(SERVICE_NAME, 'Received embeddings from API.');
        return response.data.embeddings;
        
    } catch (error) {
        logger.error(SERVICE_NAME, 'Error calling embedder API:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            logger.error(SERVICE_NAME, 'FATAL: Cannot connect to embedder service. Make sure it is running on port 8001.');
            throw new Error('Embedding service is offline. Please contact an administrator.');
        }
        throw new Error(`Embedding API error: ${error.message}`);
    }
}

/**
 * [REFACTORED] Gets a single embedding for a query string.
 * @param {string} query - The query text.
 * @returns {Promise<number[]>} A promise that resolves to a single embedding.
 */
async function getEmbeddingForQuery(query) {
    const embeddings = await getEmbeddings([query]);
    return embeddings[0];
}

module.exports = { getEmbeddings, getEmbeddingForQuery };