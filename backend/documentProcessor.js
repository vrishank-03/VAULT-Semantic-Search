// backend/documentProcessor.js - ENTERPRISE OCR ADAPTER
// --------------------------------------------------------
// [COMPONENT] Text Extraction Layer
// [ROLE] Bridges the external Python OCR service (Port 8002) with Node.js.
// [COMPATIBILITY] Outputs standardized text chunks ready for embedding.
// --------------------------------------------------------

const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const logger = require('./utils/logger');

const SERVICE_NAME = 'DocumentProcessor';
const PARSER_API_URL = process.env.PARSER_API_URL || 'http://127.0.0.1:8002/parse';

// --- [WIN_FIX] ENVIRONMENT OVERRIDE FOR TESSERACT ---
// This forces the Node process (and any Python child processes) to see Tesseract
if (process.env.TESSERACT_PATH_OVERRIDE) {
    const tessPath = process.env.TESSERACT_PATH_OVERRIDE;
    // Append to PATH if not already present
    if (!process.env.PATH.includes(tessPath)) {
        logger.info(SERVICE_NAME, `[CONFIG] Force-injecting Tesseract into PATH: ${tessPath}`);
        process.env.PATH = `${tessPath};${process.env.PATH}`;
    }
}

if (process.env.TESSDATA_PREFIX_OVERRIDE) {
    process.env.TESSDATA_PREFIX = process.env.TESSDATA_PREFIX_OVERRIDE;
    logger.info(SERVICE_NAME, `[CONFIG] Applied TESSDATA_PREFIX: ${process.env.TESSDATA_PREFIX}`);
}
// ----------------------------------------------------

/**
 * [ENTERPRISE] Normalizes raw API chunks into the system's standard format.
 * This acts as an 'Adapter' between external Python parsers and our internal DB.
 */
const normalizeChunks = (rawChunks, filename) => {
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) {
        logger.warn(SERVICE_NAME, `[NORMALIZER] Received empty or invalid chunks array for ${filename}.`);
        return [];
    }

    // [DEBUG] Log the keys of the first chunk to verify Python output
    const firstKeys = Object.keys(rawChunks[0]);
    logger.info(SERVICE_NAME, `[NORMALIZER] Incoming Chunk Structure (Keys): [${firstKeys.join(', ')}]`);

    return rawChunks.map((chunk, index) => {
        // 1. Map 'text' (Unstructured default) -> 'content' (DB requirement)
        let content = chunk.text || chunk.content || chunk.page_content || "";

        // 2. Sanitize string (remove null bytes that break Postgres)
        content = content.replace(/\0/g, '').trim();

        // 3. Metadata Enforcement
        const safeMetadata = {
            ...(chunk.metadata || {}),
            filename: filename,         // [CRITICAL FIX] Force filename injection
            source: filename,           // redundant but safe for different UI consumers
            page_number: chunk.metadata?.page_number || chunk.page_number || 1
        };

        return {
            id: chunk.id || `raw-${index}-${Date.now()}`,
            content: content,
            page_number: safeMetadata.page_number,
            metadata: safeMetadata
        };
    }).filter(c => c.content.length > 0); // Final filter for empty strings
};

/**
 * Processes a document by calling the external enterprise parsing API.
 * @param {string} filePath - The absolute path to the file.
 * @param {string} originalName - The original filename.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of STANDARDIZED chunk objects
 */
async function processDocument(filePath, originalName) {
    logger.info(SERVICE_NAME, `Calling Enterprise Parsing API for: ${originalName}`);

    // 1. Validate File Existence
    if (!fs.existsSync(filePath)) {
        logger.error(SERVICE_NAME, `[FATAL] File not found at path: ${filePath}`);
        throw new Error(`File upload failed. Local file missing.`);
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
        filename: originalName,
    });

    try {
        // 2. Call External Service
        const response = await axios.post(PARSER_API_URL, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const rawChunks = response.data.chunks || [];
        logger.info(SERVICE_NAME, `Parser API Raw Response: Received ${rawChunks.length} elements.`);

        // 3. Normalize & Validate Data
        const validChunks = normalizeChunks(rawChunks, originalName);

        if (validChunks.length === 0 && rawChunks.length > 0) {
            logger.error(SERVICE_NAME, `[DATA_LOSS] MAPPING FAILED. Python sent ${rawChunks.length} chunks, but Normalizer output 0.`);
        } else {
            logger.info(SERVICE_NAME, `[SUCCESS] Normalized ${validChunks.length} chunks for downstream processing.`);
        }

        return validChunks;

    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to process document via Parser API: ${originalName}`, error);

        if (error.code === 'ECONNREFUSED') {
            logger.error(SERVICE_NAME, `FATAL: Cannot connect to Parser API (Port 8002). Is python parser.py running?`);
            throw new Error('Parsing service is offline.');
        }

        const detail = error.response?.data?.detail || error.message;

        // [WIN_FIX] Specific hint for Tesseract errors
        if (detail && (detail.includes("tesseract is not installed") || detail.includes("not in your PATH"))) {
            logger.error(SERVICE_NAME, "[WIN_FIX] Tesseract not found. Ensure TESSERACT_PATH_OVERRIDE is set in .env");
            throw new Error("OCR Configuration Error: Server cannot find Tesseract.");
        }

        if (detail && detail.toLowerCase().includes('password')) {
            throw new Error("PasswordProtectedError");
        }

        throw new Error(detail);
    }
}

module.exports = { processDocument };