// backend/services/QueueService.js
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { processDocument } = require('../documentProcessor');
const { saveDocumentChunks } = require('../database');
const fs = require('fs');

// [WORKER_REFACTOR] The worker now handles embeddings
const { getEmbeddings } = require('../ml_runner'); 

const SERVICE_NAME = 'QueueService';

// --- Redis Connection ---
const connection = new Redis({
  maxRetriesPerRequest: null,
});

connection.on('connect', () => logger.info(SERVICE_NAME, 'Connected to Redis for BullMQ.'));
connection.on('error', (err) => logger.error(SERVICE_NAME, 'Redis connection error', err));

// --- Queue Definition ---
const QUEUE_NAME = 'document-processing';
const documentQueue = new Queue(QUEUE_NAME, { connection });

logger.info(SERVICE_NAME, `Queue "${QUEUE_NAME}" initialized.`);

// --- Socket.io Instance ---
let io;

function init(socketIoInstance) {
    logger.info(SERVICE_NAME, 'Socket.io instance received. Worker events are now active.');
    io = socketIoInstance;
}

// --- Job Adder ---
async function addDocumentJob(jobData) {
    logger.info(SERVICE_NAME, `Adding job to queue for: ${jobData.originalName}`);
    await documentQueue.add('process-document', jobData, {
        removeOnComplete: true,
        removeOnFail: { count: 1000 },
    });
}

// --- Worker Definition [REFACTORED] ---
const worker = new Worker(QUEUE_NAME, async (job) => {
    const { filePath, originalName, userId, roomId, socketId } = job.data;
    logger.info(SERVICE_NAME, `[WORKER] Processing job ${job.id}: ${originalName} (Room: ${roomId})`);

    const notifyUser = (type, payload) => {
        if (io && socketId) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('document_status', { type, ...payload });
            } else {
                logger.warn(SERVICE_NAME, `[WORKER] Could not find socket ${socketId} to send status.`);
            }
        }
    };

    try {
        // --- 1. Parse Document (Calls parser.py API) ---
        notifyUser('status', { message: `Parsing ${originalName} (layout analysis & OCR)...` });
        // This now returns high-quality, logical chunks: [{ text, page_number, type }]
        const chunks = await processDocument(filePath, originalName);
        
        let chunksWithVectors = [];

        // --- 2. Get Embeddings (Calls embedder.py API) ---
        if (chunks.length > 0) {
            notifyUser('status', { message: `Embedding ${chunks.length} text chunks...` });
            
            // Get text from chunks
            const chunkTexts = chunks.map(c => c.text);
            
            // Call the embedder API
            const vectors = await getEmbeddings(chunkTexts);
            
            // Combine chunks with their vectors
            chunksWithVectors = chunks.map((chunk, i) => ({
                ...chunk,
                vector: vectors[i]
            }));
            
            logger.info(SERVICE_NAME, `[WORKER] Job ${job.id}: Successfully embedded ${vectors.length} chunks.`);

        } else {
            logger.warn(SERVICE_NAME, `[WORKER] Job ${job.id}: ${originalName} resulted in 0 valid chunks. Saving metadata only.`);
        }
        
        // --- 3. Save to DB (SQLite & Chroma) ---
        notifyUser('status', { message: `Saving ${chunksWithVectors.length} chunks to database...` });
        const result = await saveDocumentChunks(
            userId, 
            originalName, 
            filePath, 
            chunksWithVectors, // This will be empty if no text was found, which is fine
            roomId
        );

        logger.info(SERVICE_NAME, `[WORKER] Job ${job.id} COMPLETE. Document ID: ${result.documentId}`);
        
        // --- 4. Notify User of Success ---
        notifyUser('complete', {
            message: `Successfully processed ${originalName} (found ${chunksWithVectors.length} chunks).`,
            documentId: result.documentId,
            documentName: originalName,
        });
        
        return { documentId: result.documentId, chunks: chunksWithVectors.length };

    } catch (error) {
        logger.error(SERVICE_NAME, `[WORKER] Job ${job.id} FAILED for ${originalName}:`, error);

        let userErrorMessage = `Failed to process ${originalName}.`;
        if (error.message.includes("CorruptedFileError")) {
            userErrorMessage = `Failed: "${originalName}" is corrupted or unreadable.`;
        } else if (error.message.includes("PasswordProtectedError")) {
            userErrorMessage = `Failed: "${originalName}" is password-protected.`;
        } else if (error.message.includes("Embedding service is offline")) {
            userErrorMessage = "Critical Error: The embedding service is offline. Please contact support.";
        } else if (error.message.includes("Parsing service is offline")) {
            userErrorMessage = "Critical Error: The parsing service is offline. Please contact support.";
        }

        notifyUser('error', { message: userErrorMessage, details: error.message });

        // Clean up the failed upload
        try {
            fs.unlinkSync(filePath);
            logger.info(SERVICE_NAME, `[WORKER] Cleaned up failed upload: ${filePath}`);
        } catch (unlinkErr) {
            logger.error(SERVICE_NAME, `[WORKER] CRITICAL: Failed to clean up file ${filePath}:`, unlinkErr.message);
        }

        // Re-throw the error to mark the job as failed in BullMQ
        throw error;
    }
}, { 
    connection,
    // Increase concurrency: This worker can now handle 5 jobs at once.
    // This is because the heavy lifting (parsing, embedding) is on
    // different servers. This worker just makes API calls.
    concurrency: 5 
});

worker.on('completed', (job, result) => {
    logger.info(SERVICE_NAME, `[WORKER] Job ${job.id} has completed. Result:`, result);
});

worker.on('failed', (job, err) => {
    logger.error(SERVICE_NAME, `[WORKR] Job ${job.id} has failed. Error: ${err.message}`);
});

module.exports = {
    init,
    addDocumentJob,
};