// backend/services/RAGPipelineService.js
// --------------------------------------------------------
// [ENTERPRISE FIX] Replaced direct socket.emit with Redis Publisher
// --------------------------------------------------------

const Redis = require('ioredis'); // [NEW] Required for bridging
const logger = require('../utils/logger');
const { query } = require('../database');
const RetrievalService = require('./RetrievalService');
const GenerationService = require('./GenerationService');
const FormattingService = require('./FormattingService');
const ChatHistoryService = require('./ChatHistoryService');
require('dotenv').config();

const SERVICE_NAME = 'RAGPipelineService';

// --- [NEW] REDIS PUBLISHER SETUP ---
// We publish events here. backend/index.js subscribes and relays them to the real socket.
const redisPublisher = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
});

const NOTIFICATION_CHANNEL = 'socket-notifications';

/**
 * [HELPER] Safe Publisher
 * Instead of socket.emit(), we publish to Redis. 
 * The API Gateway (index.js) picks this up and sends it to the frontend.
 */
const safeEmit = (socketId, event, data) => {
    if (!socketId) {
        logger.warn(SERVICE_NAME, `[EMIT_FAIL] No socketId provided for event: ${event}`);
        return;
    }

    const payload = JSON.stringify({
        targetSocketId: socketId,
        event: event,
        data: data
    });

    redisPublisher.publish(NOTIFICATION_CHANNEL, payload)
        .catch(err => logger.error(SERVICE_NAME, `[REDIS_FAIL] Failed to publish ${event}:`, err));
};

// --- NEW HELPER: Runs PostgreSQL Read-Only Query ---
const runMetadataQuery = async (sqlQuery, socketId, responseEventName) => {
    logger.info(SERVICE_NAME, `[PG_QUERY] Executing metadata query: ${sqlQuery.substring(0, 100)}...`);
    try {
        const res = await query(sqlQuery);
        logger.info(SERVICE_NAME, `[PG_QUERY] SQL query successful. Found ${res.rows.length} rows.`);
        return res.rows;
    } catch (err) {
        logger.error(SERVICE_NAME, `[PG_QUERY] SQL query failed: ${err.message}. Query: ${sqlQuery}`);
        safeEmit(socketId, responseEventName, {
            type: 'error',
            data: { message: 'The database query failed due to invalid SQL or permissions.' }
        });
        throw err;
    }
};

// --- MAIN ORCHESTRATOR ---
async function handleUserQuery(options) {
    const {
        query, userId, userRole, roomId, conversationId, chatMode: initialMode,
        socket, // [LEGACY] Might be a mock or disconnected object
        socketId, // [CRITICAL] The actual ID string we need for Redis
        responseEventName
    } = options;

    // Fallback: If socketId wasn't passed explicitly, try to grab it from the socket object
    const targetSocketId = socketId || socket?.id;

    if (!targetSocketId) {
        logger.error(SERVICE_NAME, "[FATAL] No targetSocketId found. Cannot stream response.");
        return;
    }

    logger.info(SERVICE_NAME, `--- 1. RAG PIPELINE START | Convo ID: ${conversationId} | Mode: ${initialMode} | Socket: ${targetSocketId} ---`);

    let fullAiResponse = "";
    let finalPayload = {};
    let finalChatMode = initialMode;
    let mathResults = [];

    try {
        // --- 2. AGENT 1: Classification & Mode Selection ---
        safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Understanding user intent & scope...' } });

        const classification = await GenerationService.classifyQuery(query, userRole, initialMode);
        finalChatMode = classification.chatMode;
        safeEmit(targetSocketId, responseEventName, { type: 'classification', data: classification });

        logger.info(SERVICE_NAME, `[AGENT] Classified Action: ${classification.queryType}. Final Mode: ${finalChatMode}`);

        // --- 3. ACTION ROUTING ---
        switch (classification.queryType) {

            // === PATH A: METADATA / SQL ===
            case 'METADATA':
            case 'SQL_METADATA':
                logger.info(SERVICE_NAME, `[AGENT] Query classified as METADATA. SQL: ${classification.sql}`);

                if (!classification.sql || classification.sql === 'PERMISSION_DENIED') {
                    fullAiResponse = classification.sql === 'PERMISSION_DENIED'
                        ? "I'm sorry, your role does not have permission to query system logs."
                        : "I failed to generate a valid metadata query. Please try rephrasing.";
                    safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: fullAiResponse });
                    finalPayload = { answer: fullAiResponse, sources: [] };
                    break;
                }

                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Querying PostgreSQL metadata...' } });
                const sqlResult = await runMetadataQuery(classification.sql, targetSocketId, responseEventName);

                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Synthesizing metadata answer...' } });
                const metaStream = GenerationService.streamMetadataAnswer(query, JSON.stringify(sqlResult, null, 2), finalChatMode);

                for await (const chunk of metaStream) {
                    fullAiResponse += chunk;
                    safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: chunk });
                }

                finalPayload = await FormattingService.formatMetadataAnswer(fullAiResponse, sqlResult);
                break;

            // === PATH B: RAG (VECTOR + KEYWORD) ===
            case 'VECTOR':
            case 'VECTOR_RAG':
                logger.info(SERVICE_NAME, `[AGENT] Query classified as VECTOR/RAG. Starting Hybrid Retrieval...`);

                // --- 4. RAG Step 1: Query Transformation ---
                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Optimizing search strategy...' } });

                const candidateDocs = await RetrievalService.getDocumentList(roomId);
                const candidateDocNames = candidateDocs.map(d => d.name);

                const rephrasedQuery = await GenerationService.transformQuery(query, candidateDocNames, finalChatMode);
                logger.info(SERVICE_NAME, `[AGENT] Transformed query: "${rephrasedQuery.substring(0, 50)}..."`);


                // --- 5. RAG Step 2: Hybrid Retrieval ---
                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Scanning documents for relevant context...' } });

                const retrievalResult = await RetrievalService.retrieveChunks(
                    rephrasedQuery,
                    roomId,
                    classification.documentFilter,
                    finalChatMode === 'DEEP_RESEARCH' ? 25 : 15
                );

                const mergedChunks = retrievalResult.chunks;

                // [MODE SWITCHING]
                if (retrievalResult.suggestedMode === 'SEQUENTIAL') {
                    finalChatMode = 'SEQUENTIAL';
                    logger.info(SERVICE_NAME, `[MODE_SWITCH] Retrieval suggested SEQUENTIAL mode (Switching to Gemini).`);
                }

                // [OBSERVABILITY] Log the decision path
                logger.info(SERVICE_NAME, `[MODE_COORDINATION] Initial: ${initialMode} → Final: ${finalChatMode} | Reason: ${retrievalResult.suggestedMode || 'No override'}`);

                if (mergedChunks.length === 0) {
                    logger.warn(SERVICE_NAME, 'Hybrid Retrieval found no relevant sources.');
                    fullAiResponse = `I'm sorry, but I couldn't find any information related to "${query}" in the available documents.`;
                    safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: fullAiResponse });
                    finalPayload = { answer: fullAiResponse, sources: [] };
                    break;
                }

                // --- 6. RAG Step 3: Re-ranking ---
                let relevantSources = mergedChunks;

                if (finalChatMode !== 'SEQUENTIAL') {
                    safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Cross-referencing & filtering results...' } });
                    const relevantIndices = await GenerationService.rerankChunks(rephrasedQuery, mergedChunks, finalChatMode);
                    relevantSources = relevantIndices.map(idx => mergedChunks[idx]).filter(Boolean);
                } else {
                    logger.info(SERVICE_NAME, `[RERANK] Skipping re-ranking for Sequential Mode (Preserving reading order).`);
                }

                if (relevantSources.length === 0) {
                    logger.warn(SERVICE_NAME, 'Re-ranker filtered out all sources.');
                    fullAiResponse = `I'm sorry, but after filtering the available information, I couldn't find a precise answer for "${query}".`;
                    safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: fullAiResponse });
                    finalPayload = { answer: fullAiResponse, sources: [] };
                    break;
                }

                // --- 7. RAG Step 4: Math Check ---
                if (query.toLowerCase().includes('calculate') || query.toLowerCase().includes('sum') || query.toLowerCase().includes('average') || query.toLowerCase().includes('percent')) {
                    safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Running calculations...' } });
                    try {
                        const mathExpression = await GenerationService.extractMathExpression(query, relevantSources);
                        if (mathExpression) {
                            const mathResult = await GenerationService.executeMath(mathExpression, finalChatMode);
                            mathResults.push({ expression: mathExpression, result: mathResult });
                        }
                    } catch (mathErr) {
                        logger.warn(SERVICE_NAME, `Math execution failed: ${mathErr.message}`);
                    }
                }

                // --- 8. RAG Step 5: Context Assembly ---
                const labeledContext = relevantSources
                    .map(source => {
                        const name = source.metadata?.documentName || "Unknown";
                        const page = source.metadata?.pageNumber || 1;
                        const text = source.text || "";
                        return `[Source: ${name}, Page ${page}]:\n${text}`;
                    })
                    .join('\n\n---\n\n');

                // [CRITICAL DEBUG LOG RESTORED]
                logger.debug(SERVICE_NAME, '--- FINAL CONTEXT FOR LLM ---', { snippet: labeledContext.substring(0, 300) + '...' });

                // --- 9. RAG Step 6: Final Synthesis ---
                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Synthesizing final insights...' } });

                const answerStream = GenerationService.streamFinalAnswer(labeledContext, query, finalChatMode, mathResults);

                for await (const chunk of answerStream) {
                    fullAiResponse += chunk;
                    // [FIX] Use safeEmit instead of socket.emit
                    safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: chunk });
                }

                // --- 10. Final Formatting ---
                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Formatting citations...' } });
                finalPayload = await FormattingService.formatAnswer(fullAiResponse, relevantSources);
                break;

            // === PATH C: DIRECT LLM ===
            case 'LLM':
            case 'HYPOTHETICAL':
                logger.info(SERVICE_NAME, `[AGENT] Query classified as LLM/HYPOTHETICAL.`);
                safeEmit(targetSocketId, responseEventName, { type: 'status', data: { message: 'Thinking...' } });

                const directPrompt = [{ role: 'user', content: `Respond to this directly: ${query}` }];
                const directStream = GenerationService.generateStreamingResponse(directPrompt, finalChatMode, 0.7);

                for await (const chunk of directStream) {
                    fullAiResponse += chunk;
                    safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: chunk });
                }
                finalPayload = { answer: fullAiResponse, sources: [] };
                break;

            // === PATH D: ACTION ===
            case 'ACTION':
                break;

            case 'GENERAL':
            default:
                logger.info(SERVICE_NAME, `[AGENT] Query classified as GENERAL.`);
                fullAiResponse = "I am a document analysis assistant. I can only answer questions using the private documents you have uploaded.";
                safeEmit(targetSocketId, responseEventName, { type: 'chunk', data: fullAiResponse });
                finalPayload = { answer: fullAiResponse, sources: [] };
                break;
        }

        // --- 11. Post-Stream Cleanup ---
        logger.info(SERVICE_NAME, '--- STREAM COMPLETE. Sending final payload. ---');
        safeEmit(targetSocketId, responseEventName, { type: 'final', data: finalPayload });

        // [LOGGING RESTORED] Success log for history save
        ChatHistoryService.saveMessages(conversationId, userId, query, finalPayload.answer, finalPayload)
            .then(() => logger.info(SERVICE_NAME, `--- History saved for convo ${conversationId} ---`))
            .catch(err => logger.error(SERVICE_NAME, `--- FAILED to save history for ${conversationId} ---`, err));

        logger.info(SERVICE_NAME, '--- RAG PIPELINE END ---');

    } catch (error) {
        // [LOGGING RESTORED] Detailed error logging
        logger.error(SERVICE_NAME, `[FATAL] Unhandled error in RAG Pipeline for convo ${conversationId}:`, error);
        safeEmit(targetSocketId, responseEventName, {
            type: 'error',
            data: { message: `A fatal error occurred. Please check the logs for details. (${error.message.split(':')[0]})` }
        });
    }
}

module.exports = { handleUserQuery };