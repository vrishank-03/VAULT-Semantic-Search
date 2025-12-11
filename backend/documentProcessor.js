// backend/documentProcessor.js
// --------------------------------------------------------
// [ROLE] Node.js Adapter for Python Parser
// [OPTIMIZATION] Captures Hierarchical Data (Parent/Child)
// [RESILIENCE] Tesseract Path Injection & Error Mapping
// --------------------------------------------------------

const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const logger = require('./utils/logger');

const SERVICE_NAME = 'DocumentProcessor';
const PARSER_API_URL = process.env.PARSER_API_URL || 'http://127.0.0.1:8002/parse';

// --- [WIN_FIX] ENVIRONMENT OVERRIDE FOR TESSERACT ---
if (process.env.TESSERACT_PATH_OVERRIDE) {
    const tessPath = process.env.TESSERACT_PATH_OVERRIDE;
    if (!process.env.PATH.includes(tessPath)) {
        logger.info(SERVICE_NAME, `[CONFIG] Injecting Tesseract PATH: ${tessPath}`);
        process.env.PATH = `${tessPath};${process.env.PATH}`;
    }
}

if (process.env.TESSDATA_PREFIX_OVERRIDE) {
    process.env.TESSDATA_PREFIX = process.env.TESSDATA_PREFIX_OVERRIDE;
}

/**
 * [HIERARCHICAL ADAPTER] 
 * Maps Python's rich output to our Postgres Schema format.
 */
const normalizeChunks = (rawChunks, filename) => {
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) {
        logger.warn(SERVICE_NAME, `[NORMALIZER] No chunks returned for ${filename}.`);
        return [];
    }

    return rawChunks.map((chunk, index) => {
        // 1. Text Cleaning
        let content = chunk.text || chunk.content || "";
        content = content.replace(/\0/g, '').trim(); // Remove PostgreSQL null-bytes

        // 2. Metadata Extraction
        const safeMetadata = {
            ...(chunk.metadata || {}),
            filename: filename,
            page_number: chunk.page_number || 1,

            // [NEW] Hierarchical Fields
            parent_id: chunk.metadata?.parent_id || null,
            is_header: chunk.metadata?.is_header || false,
            section: chunk.metadata?.section || "General"
        };

        return {
            id: chunk.id || `raw-${index}-${Date.now()}`,
            content: content,
            page_number: safeMetadata.page_number,

            // [NEW] Top-Level Fields for SQL Insertion
            parent_id: safeMetadata.parent_id,
            is_header: safeMetadata.is_header,

            metadata: safeMetadata
        };
    }).filter(c => c.content.length > 0);
};

/**
 * Sends file to Python Microservice -> Receives Hierarchical JSON -> Returns Normalized Data
 */
async function processDocument(filePath, originalName) {
    logger.info(SERVICE_NAME, `[START] Processing: ${originalName}`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File upload failed. Local file missing at ${filePath}`);
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), { filename: originalName });

    try {
        // 1. Call Python Service
        const response = await axios.post(PARSER_API_URL, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const rawChunks = response.data.chunks || [];

        // 2. Normalize
        const validChunks = normalizeChunks(rawChunks, originalName);

        // 3. Hierarchy Statistics (For Debugging)
        const headerCount = validChunks.filter(c => c.is_header).length;
        const childCount = validChunks.filter(c => c.parent_id).length;

        logger.info(SERVICE_NAME, `[SUCCESS] Extracted ${validChunks.length} chunks. (Headers: ${headerCount}, Children: ${childCount})`);

        return validChunks;

    } catch (error) {
        logger.error(SERVICE_NAME, `[FAIL] Parsing failed for ${originalName}`, error);

        // Error Translation
        const detail = error.response?.data?.detail || error.message;
        if (error.code === 'ECONNREFUSED') {
            throw new Error('Parsing Service (Port 8002) is offline.');
        }
        if (detail && detail.includes("tesseract")) {
            throw new Error("OCR Error: Server cannot find Tesseract. Check configuration.");
        }
        throw new Error(detail);
    }
}

module.exports = { processDocument };