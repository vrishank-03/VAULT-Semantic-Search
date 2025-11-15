// backend/services/RAGPipelineService.js

const logger = require('../utils/logger');
const { getDb } = require('../database');
const { getEmbeddingForQuery } = require('../ml_runner');
const RetrievalService = require('./RetrievalService');
const GenerationService = require('./GenerationService');
const FormattingService = require('./FormattingService');
const ChatHistoryService = require('./ChatHistoryService');
const VectorDBService = require('./VectorDBService');

const SERVICE_NAME = 'RAGPipelineService';

/**
 * Runs a read-only, safe metadata query.
 */
const runMetadataQuery = (sqlQuery, socket, responseEventName) => {
    return new Promise((resolve, reject) => {
        const db = getDb();
        db.all(sqlQuery, [], (err, rows) => {
            if (err) {
                logger.error(SERVICE_NAME, `[AGENT] SQL query failed: ${err.message}. Query: ${sqlQuery}`);
                socket.emit(responseEventName, {
                    type: 'error',
                    data: { message: 'The metadata query failed.' }
                });
                return reject(err);
            }
            logger.info(SERVICE_NAME, `[AGENT] SQL query successful. Found ${rows.length} rows.`);
            resolve(rows);
        });
    });
};

/**
 * Main orchestrated RAG pipeline.
 */
async function handleUserQuery(options) {
    const {
        query, modelName, isDeepThink,
        userId, userRole, roomId, conversationId,
        socket, responseEventName
    } = options;

    logger.info(SERVICE_NAME, `--- 1. RAG PIPELINE START | Convo ID: ${conversationId} | Room ID: ${roomId} ---`);
    
    let fullAiResponse = "";
    let finalPayload = {};

    try {
        const docList = await RetrievalService.getDocumentList(roomId);
        logger.debug(SERVICE_NAME, `--- 1b. Found ${docList.length} documents.`);

        socket.emit(responseEventName, { type: 'status', data: { message: 'Analyzing query...' }});
        const classification = await GenerationService.classifyQuery(query, userRole, docList);
        socket.emit(responseEventName, { type: 'classification', data: classification });

        switch (classification.queryType) {
            
            case 'METADATA':
                logger.info(SERVICE_NAME, `[AGENT] Query classified as METADATA.`);
                if (classification.sql === 'PERMISSION_DENIED') {
                    logger.warn(SERVICE_NAME, `[AGENT] User ${userId} (Role: ${userRole}) denied access to logs.`);
                    fullAiResponse = "I'm sorry, but your role does not have permission to query system logs.";
                    socket.emit(responseEventName, { type: 'chunk', data: fullAiResponse });
                    finalPayload = { answer: fullAiResponse, sources: [] };
                    break; 
                }

                socket.emit(responseEventName, { type: 'status', data: { message: 'Querying system metadata...' }});
                const sqlResult = await runMetadataQuery(classification.sql, socket, responseEventName);
                const sqlResultJson = JSON.stringify(sqlResult, null, 2);

                socket.emit(responseEventName, { type: 'status', data: { message: 'Formatting metadata...' }});
                const metaStream = GenerationService.streamMetadataAnswer(query, sqlResultJson, modelName);
                
                for await (const chunk of metaStream) {
                    fullAiResponse += chunk;
                    socket.emit(responseEventName, { type: 'chunk', data: chunk });
                }
                
                finalPayload = await FormattingService.formatMetadataAnswer(fullAiResponse, sqlResult);
                break;

            case 'VECTOR':
                // [SCOPED_SEARCH_FIX] Log the document filter
                logger.info(SERVICE_NAME, `[AGENT] Query classified as VECTOR. Rephrased: "${classification.rephrasedQuery}". Filter: ${JSON.stringify(classification.documentFilter)}`);
                
                socket.emit(responseEventName, { type: 'status', data: { message: 'Retrieving relevant documents...' }});
                logger.info(SERVICE_NAME, '--- 4. RETRIEVING CHUNKS ---');
                const embedding = await getEmbeddingForQuery(classification.rephrasedQuery);
                
                // [SCOPED_SEARCH_FIX] Pass the documentFilter to the query service
                const initialResults = await VectorDBService.queryByRoom(
                    embedding, 
                    roomId, 
                    10, 
                    classification.documentFilter // <-- This is the new filter
                );

                if (!initialResults || initialResults.documents.length === 0 || initialResults.documents[0].length === 0) {
                    logger.warn(SERVICE_NAME, 'No relevant chunks found. Returning early.');
                    fullAiResponse = "I couldn't find any relevant information for that query in your documents.";
                    socket.emit(responseEventName, { type: 'chunk', data: fullAiResponse });
                    finalPayload = { answer: fullAiResponse, sources: [] };
                    break;
                }
                
                const initialChunks = initialResults.documents[0].map((doc, index) => ({
                    text: doc,
                    metadata: initialResults.metadatas[0][index]
                }));
                
                socket.emit(responseEventName, { type: 'status', data: { message: 'Re-ranking results...' }});
                logger.info(SERVICE_NAME, '--- 6. CALLING RE-RANKER ---');
                const relevantIndices = await GenerationService.rerankChunks(classification.rephrasedQuery, initialChunks);
                const relevantSources = relevantIndices
                    .map(index => (index >= 0 && initialChunks.length > index) ? initialChunks[index] : null)
                    .filter(Boolean);
                logger.info(SERVICE_NAME, `--- 9. Final Relevant Sources Count: ${relevantSources.length} ---`);

                if (relevantSources.length === 0) {
                    logger.warn(SERVICE_NAME, 'Re-ranker found no relevant sources. Returning early.');
                    fullAiResponse = "I found some documents, but after re-ranking, none seemed relevant to your specific query.";
                    socket.emit(responseEventName, { type: 'chunk', data: fullAiResponse });
                    finalPayload = { answer: fullAiResponse, sources: [] };
                    break;
                }

                const labeledContext = relevantSources
                    .map(source => `[Source from Document ID ${source.metadata.documentId}, Page ${source.metadata.pageNumber}]:\n${source.text}`)
                    .join('\n---\n');

                socket.emit(responseEventName, { type: 'status', data: { message: 'Synthesizing answer...' }});
                logger.info(SERVICE_NAME, '--- 10. CALLING FINAL ANSWER SYNTHESIZER ---');
                const answerStream = GenerationService.streamFinalAnswer(labeledContext, query, modelName, isDeepThink);

                for await (const chunk of answerStream) {
                    fullAiResponse += chunk;
                    socket.emit(responseEventName, { type: 'chunk', data: chunk });
                }

                socket.emit(responseEventName, { type: 'status', data: { message: 'Formatting citations...' }});
                finalPayload = await FormattingService.formatAnswer(fullAiResponse, relevantSources);
                break;

            case 'GENERAL':
            default:
                logger.info(SERVICE_NAME, `[AGENT] Query classified as GENERAL.`);
                socket.emit(responseEventName, { type: 'status', data: { message: 'Generating response...' }});
                const generalStream = GenerationService.streamFinalAnswer(
                    "No context provided.", 
                    `The user asked a general question: "${query}". Respond conversationally.`,
                    modelName,
                    false
                );

                for await (const chunk of generalStream) {
                    fullAiResponse += chunk;
                    socket.emit(responseEventName, { type: 'chunk', data: chunk });
                }
                finalPayload = { answer: fullAiResponse, sources: [] };
                break;
        }

        logger.info(SERVICE_NAME, '--- 11. STREAM COMPLETE. Sending final payload. ---');
        socket.emit(responseEventName, { type: 'final', data: finalPayload });

        ChatHistoryService.saveMessages(conversationId, userId, query, finalPayload.answer, finalPayload)
            .then(() => logger.info(SERVICE_NAME, `--- 12. History saved for convo ${conversationId} ---`))
            .catch(err => logger.error(SERVICE_NAME, `--- 12. FAILED to save history for ${conversationId} ---`, err));
        
        logger.info(SERVICE_NAME, '--- 13. RAG PIPELINE END ---');

    } catch (error) {
        logger.error(SERVICE_NAME, `[FATAL] Unhandled error in RAG Pipeline for convo ${conversationId}:`, error);
        socket.emit(responseEventName, {
            type: 'error',
            data: { message: `A fatal pipeline error occurred: ${error.message}` }
        });
    }
}

module.exports = {
    handleUserQuery,
};