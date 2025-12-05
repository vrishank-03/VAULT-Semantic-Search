// backend/searchService.js - EXECUTION-FIRST RAG ENGINE
// --------------------------------------------------------
// [ARCH_DECISION] Replaced pgvector dependency with Node-side cosine similarity.
// [REASON] prioritizes portability/installation (Standard Postgres Arrays) over peak scale.
// [PERFORMANCE] O(N) scan scoped to room_id. fast for <10k chunks per room.
// [COMPATIBILITY] Includes deleteDocumentFromChroma alias for legacy routes.
// --------------------------------------------------------

const { query, deleteDocumentById } = require('./database');
const { generateResponse } = require('./services/GenerationService');
const { saveMessage } = require('./services/ChatHistoryService');
const { formatContext } = require('./services/FormattingService');
const { spawnPythonWorker } = require('./ml_runner'); // To get query embeddings
const logger = require('./utils/logger');

// --- CONFIGURATION ---
const MAX_CONTEXT_CHUNKS = 7; // Number of chunks to retrieve
const MIN_SIMILARITY_THRESHOLD = 0.25; // Filter out completely irrelevant noise

/**
 * [MATH_CORE] Calculates Cosine Similarity between two vectors.
 * Formula: (A . B) / (||A|| * ||B||)
 * @param {number[]} vecA - The query vector
 * @param {number[]} vecB - The document chunk vector
 * @returns {number} - Similarity score (-1 to 1)
 */
function calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * [SEARCH_ENGINE] Performs semantic search using Node.js logic.
 * 1. Embeds the query.
 * 2. Fetches ALL chunks for the given room (Scoped Scan).
 * 3. Calculates similarity in-memory.
 * 4. Sorts and returns top K.
 */
async function performSemanticSearch(queryText, roomId) {
    const start = Date.now();
    try {
        logger.info('SEARCH_SERVICE', `[1/4] Embedding query: "${queryText.substring(0, 30)}..."`);

        // 1. Get Query Embedding from Python
        // We use the same 'embedder.py' but via ml_runner
        const embeddingResult = await spawnPythonWorker('embedder.py', 'embed_query', { query: queryText });

        if (!embeddingResult || !embeddingResult.embedding) {
            throw new Error('Failed to generate embedding for query.');
        }
        const queryVector = embeddingResult.embedding;

        // 2. Fetch Candidates (Scoped by Room)
        // We fetch 'embedding' (FLOAT8[]) directly as a JS array
        logger.info('SEARCH_SERVICE', `[2/4] Fetching chunks for Room ${roomId}...`);

        const sql = `
            SELECT 
                dc.content, 
                dc.embedding, 
                d.name as source_doc, 
                dc.page_number
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.room_id = $1
        `;

        const { rows } = await query(sql, [roomId]);

        if (rows.length === 0) {
            logger.warn('SEARCH_SERVICE', 'No documents found in this room.');
            return [];
        }

        // 3. Vector Math (The Node.js "Engine")
        logger.info('SEARCH_SERVICE', `[3/4] calculating similarity for ${rows.length} chunks...`);

        const scoredChunks = rows.map(row => {
            const score = calculateCosineSimilarity(queryVector, row.embedding);
            return {
                content: row.content,
                source: row.source_doc,
                page: row.page_number,
                score: score
            };
        });

        // 4. Rank & Filter
        const topChunks = scoredChunks
            .filter(chunk => chunk.score >= MIN_SIMILARITY_THRESHOLD)
            .sort((a, b) => b.score - a.score) // Descending order
            .slice(0, MAX_CONTEXT_CHUNKS);

        const duration = Date.now() - start;
        logger.info('SEARCH_SERVICE', `[4/4] Search complete in ${duration}ms. Top score: ${topChunks[0]?.score?.toFixed(4) || 'N/A'}`);

        return topChunks;

    } catch (err) {
        logger.error('SEARCH_SERVICE', 'Semantic search failed:', err.message);
        return []; // Return empty on failure to allow graceful fallback
    }
}

/**
 * [RAG_ORCHESTRATOR] Main entry point for Chat Generation.
 */
async function performRAG(userId, userQuery, history, conversationId, roomId) {
    try {
        // 1. Retrieve relevant context
        const contextChunks = await performSemanticSearch(userQuery, roomId);

        // 2. Format context for the LLM
        const formattedContext = formatContext(contextChunks);

        // 3. Generate Answer
        logger.info('SEARCH_SERVICE', 'Generating AI response...');
        const aiResponse = await generateResponse(userQuery, formattedContext, history);

        // 4. Save Interaction
        if (conversationId) {
            await saveMessage(conversationId, 'user', userQuery, null);
            await saveMessage(conversationId, 'assistant', aiResponse, contextChunks); // Save sources too
        }

        return {
            answer: aiResponse,
            sources: contextChunks.map(c => ({ name: c.source, page: c.page }))
        };

    } catch (error) {
        logger.error('RAG_FLOW', 'Critical RAG failure:', error.message);
        throw error;
    }
}

module.exports = {
    performRAG,
    performSemanticSearch,
    // [COMPATIBILITY] Routes expect this name, but we map it to the SQL delete function
    deleteDocumentFromChroma: deleteDocumentById
};