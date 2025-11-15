// backend/documentProcessor.js

const fs = require('fs');
const axios = require('axios'); // Requires 'npm install axios'
const FormData = require('form-data'); // Requires 'npm install form-data'
const logger = require('./utils/logger');

const SERVICE_NAME = 'DocumentProcessor';

// The port (8002) must match the port you run 'parser.py' on
const PARSER_API_URL = 'http://127.0.0.1:8002/parse';

/**
 * [REFACTORED] Processes a document by calling the external enterprise parsing API.
 * @param {string} filePath - The absolute path to the file.
 * @param {string} originalName - The original filename.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of chunk objects
 */
async function processDocument(filePath, originalName) {
    logger.info(SERVICE_NAME, `Calling Enterprise Parsing API for: ${originalName}`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
        filename: originalName,
    });

    try {
        const response = await axios.post(PARSER_API_URL, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const chunks = response.data.chunks || [];
        logger.info(SERVICE_NAME, `Parser API succeeded. Extracted ${chunks.length} chunks from ${originalName}.`);
        
        return chunks;

    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to process document via Parser API: ${originalName}`, error);

        if (error.code === 'ECONNREFUSED') {
            logger.error(SERVICE_NAME, `FATAL: Cannot connect to Parser API. Make sure parser.py is running on port 8002.`);
            throw new Error('Parsing service is offline. Please contact an administrator.');
        }
        
        const detail = error.response?.data?.detail || error.message;
        if (detail.toLowerCase().includes('password')) {
            throw new Error("PasswordProtectedError");
        }
        
        throw new Error(detail);
    }
}

module.exports = { processDocument };