// backend/services/QueueService.js - ENTERPRISE PUB/SUB + SAFETY NETS

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { processDocument } = require('../documentProcessor');
const { saveDocumentChunks } = require('../database'); 
const fs = require('fs');
const { getEmbeddings } = require('../ml_runner'); 

const SERVICE_NAME = 'QueueService';

// --- Redis Connections ---
// 1. General connection for BullMQ (Job Management)
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost', 
    port: process.env.REDIS_PORT || 6379,       
    maxRetriesPerRequest: null,
});

// 2. [ENTERPRISE] Dedicated Publisher for Notifications
// Redis clients cannot be both subscribers and publishers in blocking mode.
const redisPublisher = new Redis({
    host: process.env.REDIS_HOST || 'localhost', 
    port: process.env.REDIS_PORT || 6379,
});

const QUEUE_NAME = 'document-processing';
const NOTIFICATION_CHANNEL = 'socket-notifications'; // The "Radio Frequency"

const documentQueue = new Queue(QUEUE_NAME, { connection });

// --- Initialization ---
// In Enterprise Mode, we don't need 'io' here. We broadcast to Redis.
function init() {
    logger.info(SERVICE_NAME, '[INIT] QueueService ready (Pub/Sub Mode).');
}

// --- Job Adder ---
async function addDocumentJob(jobData) {
    logger.info(SERVICE_NAME, `[ADDER] Queuing job for ${jobData.originalName} (Socket: ${jobData.socketId})`);
    return await documentQueue.add('process-document', jobData, {
        removeOnComplete: true,
        removeOnFail: { count: 1000 },
    });
}

// --- Worker Definition ---
const worker = new Worker(QUEUE_NAME, async (job) => {
    const { filePath, originalName, userId, roomId, socketId } = job.data;
    logger.info(SERVICE_NAME, `[WORKER:START] Processing: ${originalName}`);
    
    // [ENTERPRISE NOTIFIER]
    // Broadcasts progress to Redis. The API Server (index.js) listens and relays to Frontend.
    const notifyUser = async (type, payload) => {
        if (!socketId) return;

        const message = JSON.stringify({
            targetSocketId: socketId,
            event: 'document_status',
            data: { type, ...payload }
        });

        try {
            await redisPublisher.publish(NOTIFICATION_CHANNEL, message);
            logger.debug(SERVICE_NAME, `[WORKER:PUB] Broadcasted '${type}' to Redis.`);
        } catch (err) {
            logger.error(SERVICE_NAME, `[WORKER:PUB_ERROR] Failed to publish to Redis: ${err.message}`);
        }
    };

    try {
        // --- STEP 1: PARSE ---
        notifyUser('status', { message: `Parsing ${originalName}...` });
        const chunks = await processDocument(filePath, originalName);
        
        // --- STEP 2: EMBED ---
        let chunksWithVectors = [];
        if (chunks.length > 0) {
            notifyUser('status', { message: `Embedding ${chunks.length} chunks...` });
            const vectors = await getEmbeddings(chunks.map(c => c.content));
            chunksWithVectors = chunks.map((chunk, i) => ({ ...chunk, vector: vectors[i] }));
        }
        
        // --- STEP 3: SAVE ---
        notifyUser('status', { message: `Saving to database...` });
        const res = await saveDocumentChunks(userId, originalName, filePath, chunksWithVectors, roomId);
        
        // --- STEP 4: COMPLETE ---
        notifyUser('complete', {
            message: `Processed ${originalName}`,
            documentId: res.documentId
        });

        return { documentId: res.documentId, count: chunksWithVectors.length };

    } catch (error) {
        logger.error(SERVICE_NAME, `[WORKER:FAILED] ${originalName}: ${error.message}`);
        
        const msg = error.message.includes("Password") 
            ? "File is password protected." 
            : "Processing failed. See logs.";
            
        notifyUser('error', { message: msg, details: error.message });

        // [SAFETY NET] Delete file on failure to save disk space
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(SERVICE_NAME, `[WORKER:CLEANUP] Deleted failed file: ${filePath}`);
            }
        } catch (cleanupErr) {
            logger.error(SERVICE_NAME, `[WORKER:CLEANUP_ERROR] Could not delete file: ${cleanupErr.message}`);
        }
        
        throw error;
    }
}, { 
    connection, 
    concurrency: 5 
});

// --- Event Handlers (Restored for Logging) ---
worker.on('completed', (job, result) => {
    logger.info(SERVICE_NAME, `[WORKER:BULLMQ] Job ${job.id} completed. Chunks: ${result?.count || 0}`);
});

worker.on('failed', (job, err) => {
    logger.error(SERVICE_NAME, `[WORKER:BULLMQ] Job ${job.id} failed: ${err.message}`);
});

worker.on('error', (err) => {
    logger.error(SERVICE_NAME, `[WORKER:INTERNAL] ${err.message}`);
});

module.exports = { init, addDocumentJob };