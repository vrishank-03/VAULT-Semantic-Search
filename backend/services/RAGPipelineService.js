// backend/services/RAGPipelineService.js
// New File

const logger = require('../utils/logger');
const RetrievalService = require('./RetrievalService');
const GenerationService = require('./GenerationService');
const FormattingService = require('./FormattingService');
const ChatHistoryService = require('./ChatHistoryService');

const SERVICE_NAME = 'RAGPipelineService';

/**
 * The main orchestrated RAG pipeline.
 */
async function performRAG(userId, queryText, history = [], conversationId, roomId) {
    logger.info(SERVICE_NAME, `--- 1. RAG PIPELINE START | Convo ID: ${conversationId} | Room ID: ${roomId} ---`);

    if (!roomId) {
        logger.error(SERVICE_NAME, 'performRAG called without roomId. Aborting.');
        throw new Error("Room ID is required to perform a search.");
    }

    const formattedHistory = history.map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n');

    // --- STEP 1: Get Document List (for context) ---
    const docList = await RetrievalService.getDocumentList(roomId);
    const docListString = docList.length > 0
        ? "Available documents:\n" + docList.map(doc => `- ${doc.name} (ID: ${doc.id})`).join('\n')
        : "No documents have been uploaded to this room yet.";
    
    logger.debug(SERVICE_NAME, `--- 1b. Found ${docList.length} documents.`);

    // --- STEP 2: Analyze Query (LLM Call 1) ---
    logger.info(SERVICE_NAME, '--- 2. CALLING QUERY ANALYZER ---');
    const transformedQuery = await GenerationService.analyzeQuery(formattedHistory, docListString, queryText);
    logger.info(SERVICE_NAME, `--- 3. Query Analyzer Output: "${transformedQuery}" ---`);

    if (transformedQuery.toLowerCase().includes("cannot search") || transformedQuery.toLowerCase().includes("no documents")) {
        logger.warn(SERVICE_NAME, 'Analyzer determined no search is possible (e.g., no docs).');
        const noDocPayload = { answer: "I cannot answer that as no documents have been uploaded to this room yet.", sources: [] };
        await ChatHistoryService.saveMessages(conversationId, userId, queryText, noDocPayload.answer, noDocPayload);
        return noDocPayload;
    }

    // --- STEP 3: Retrieve Chunks ---
    logger.info(SERVICE_NAME, '--- 4. RETRIEVING CHUNKS ---');
    const initialChunks = await RetrievalService.retrieveChunks(transformedQuery, roomId);

    if (!initialChunks) {
        logger.warn(SERVICE_NAME, 'No relevant chunks found. Returning early.');
        const noResultPayload = { answer: "I couldn't find any relevant information for that query in your documents.", sources: [] };
        await ChatHistoryService.saveMessages(conversationId, userId, queryText, noResultPayload.answer, noResultPayload);
        return noResultPayload;
    }

    // --- STEP 4: Re-rank Chunks (LLM Call 2) ---
    logger.info(SERVICE_NAME, '--- 6. CALLING RE-RANKER ---');
    const relevantIndices = await GenerationService.rerankChunks(transformedQuery, initialChunks);
    logger.info(SERVICE_NAME, `--- 8. Parsed Relevant Indices: [${relevantIndices.join(', ')}] ---`);

    const relevantSources = relevantIndices.map(index => {
        return (index >= 0 && initialChunks.length > index) ? initialChunks[index] : null;
    }).filter(Boolean); // Filter out any nulls

    logger.info(SERVICE_NAME, `--- 9. Final Relevant Sources Count: ${relevantSources.length} ---`);

    const labeledContext = relevantSources.length > 0
        ? relevantSources.map(source => `[Source from Document ID ${source.metadata.documentId}, Page ${source.metadata.pageNumber}]:\n${source.text}`).join('\n---\n')
        : "No relevant document chunks were found for this query.";

    // --- STEP 5: Generate Final Answer (LLM Call 3) ---
    logger.info(SERVICE_NAME, '--- 10. CALLING FINAL ANSWER SYNTHESIZER ---');
    const rawAnswer = await GenerationService.generateFinalAnswer(labeledContext, queryText);
    logger.info(SERVICE_NAME, `--- 11. Final Answer from Groq: "${rawAnswer.substring(0, 100)}..." ---`);

    // --- STEP 6: Format Answer ---
    const finalPayload = await FormattingService.formatAnswer(rawAnswer, relevantSources);

    // --- STEP 7: Save Messages (and trigger title gen) ---
    logger.info(SERVICE_NAME, '--- 12. SAVING MESSAGES ---');
    await ChatHistoryService.saveMessages(conversationId, userId, queryText, finalPayload.answer, finalPayload);

    logger.info(SERVICE_NAME, '--- 13. RAG PIPELINE END ---');
    return finalPayload;
}

module.exports = {
    performRAG,
};