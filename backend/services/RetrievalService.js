// backend/services/RetrievalService.js

const { query } = require('../database');
const { getEmbeddingForQuery } = require('../ml_runner');
const logger = require('../utils/logger');

const SERVICE_NAME = 'RetrievalService';

const MAX_CHUNKS_FETCH = 50;
const MAX_CHUNKS_RETURN = 35; 

// --- Helper: Normalizer ---
const normalizeChunk = (row, sourceMethod, score = 0) => {
    return {
        id: row.chunk_id,
        text: row.content || "",
        metadata: {
            documentId: row.document_id,
            documentName: row.document_name || row.documentName || "Unknown Document",
            pageNumber: row.page_number || row.pageNumber || 1,
            source: sourceMethod,
            score: score,
            isVector: sourceMethod === 'Vector',
            isKeyword: sourceMethod === 'Keyword',
            isSequential: sourceMethod === 'Sequential'
        }
    };
};

// --- Intent Detection (Weighted) ---
function detectQueryIntent(queryText, docNameFilter) {
    if (!docNameFilter) return 'HYBRID';

    const lowerQuery = queryText.toLowerCase().trim();
    let score = 0;

    const strongPatterns = [
        /\b(summarize|summary|overview|synopsis|abstract|recap|digest)\b/i,
        /\b(tl;dr|tldr|briefing|run through|walk through)\b/i,
        /\b(entire|whole|full) document\b/i,
        /\b(give me (a|an) (summary|overview|rundown))\b/i,
        /\b(what('s| is) this (all )?about)\b/i
    ];

    const mediumPatterns = [
        /\b(what('s| is) (in|inside|contained in))\b/i,
        /\b(content|contents) of\b/i,
        /\b(cover|covers)\b/i, 
        /\b(about|regarding)\b$/i,
        /\b(main|key) (points|ideas|takeaways|features)\b/i
    ];

    const weakPatterns = [
        /\b(tell me about|describe|explain)\b/i,
        /\b(break down|examine|analyze)\b/i,
        /\b(review|audit)\b/i
    ];

    const antiPatterns = [
        /\bwhat is (a|an|the) [a-z]+\b/i,
        /\bhow (does|do|to|can)\b/i,
        /\b(define|definition)\b/i,
        /\b(specific|specifically)\b/i
    ];

    if (strongPatterns.some(p => p.test(lowerQuery))) score += 5;
    if (mediumPatterns.some(p => p.test(lowerQuery))) score += 3;
    if (weakPatterns.some(p => p.test(lowerQuery))) score += 2;
    if (antiPatterns.some(p => p.test(lowerQuery))) score -= 3;

    if (/\b(this|the) (document|file|report|paper|pdf)\b/i.test(lowerQuery)) score += 2;
    if (lowerQuery.split(' ').length <= 5) score += 1;

    logger.debug(SERVICE_NAME, `[INTENT] Query: "${lowerQuery}" | Score: ${score}`);
    return score >= 3 ? 'SEQUENTIAL' : 'HYBRID';
}

// --- Search Strategies ---
async function runSequentialSearch(roomId, docNameFilter, limit = 60) {
    logger.info(SERVICE_NAME, `[STRATEGY] Switching to SEQUENTIAL READ for: ${docNameFilter}`);
    const sql = `
        SELECT dc.chunk_id, dc.content, dc.page_number, dc.document_id, d.name AS document_name
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.room_id = $1 AND d.name ILIKE $2
        ORDER BY dc.page_number ASC, dc.id ASC
        LIMIT $3
    `;
    const res = await query(sql, [roomId, `%${docNameFilter}%`, limit]);
    return res.rows.map(row => normalizeChunk(row, 'Sequential', 1.0)); 
}

async function runVectorSearch(queryEmbedding, roomId, limit, docNameFilter = null) {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    let clause = `WHERE dc.room_id = $2`;
    const params = [embeddingStr, roomId];
    if (docNameFilter) {
        clause += ` AND d.name ILIKE $3`;
        params.push(`%${docNameFilter}%`);
    }
    const sql = `
        SELECT dc.chunk_id, dc.content, dc.page_number, dc.document_id, d.name AS document_name,
        (dc.embedding <-> $1) AS raw_score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        ${clause} ORDER BY raw_score ASC LIMIT $${params.length + 1}
    `;
    const res = await query(sql, [...params, limit]);
    return res.rows;
}

async function runKeywordSearch(queryText, roomId, limit, docNameFilter = null) {
    let clause = `WHERE dc.room_id = $2`;
    const params = [queryText, roomId];
    if (docNameFilter) {
        clause += ` AND d.name ILIKE $3`;
        params.push(`%${docNameFilter}%`);
    }
    const sql = `
        SELECT dc.chunk_id, dc.content, dc.page_number, dc.document_id, d.name AS document_name,
        similarity(dc.content, $1) AS raw_score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        ${clause} ORDER BY raw_score DESC LIMIT $${params.length + 1}
    `;
    const res = await query(sql, [...params, limit]);
    return res.rows;
}

function applyRRF(vectorResults, keywordResults, k = 60) {
    const scoreMap = new Map();
    const process = (row, type) => {
        const rrf = 1 / (k + (row.rank || 1));
        if (!scoreMap.has(row.chunk_id)) scoreMap.set(row.chunk_id, { ...row, rrfScore: rrf, methods: [type] });
        else { const e = scoreMap.get(row.chunk_id); e.rrfScore += rrf; e.methods.push(type); }
    };
    vectorResults.forEach((r, i) => process({...r, rank: i+1}, 'Vector'));
    keywordResults.forEach((r, i) => process({...r, rank: i+1}, 'Keyword'));
    return Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}

// --- MAIN ORCHESTRATOR ---
async function hybridRetrieveChunks(queryText, roomId, docNameFilter = null, limit = MAX_CHUNKS_RETURN) {
    logger.info(SERVICE_NAME, `[HYBRID] Retrieval Start. Filter: ${docNameFilter || 'NONE'}`);

    try {
        const intent = detectQueryIntent(queryText, docNameFilter);

        if (intent === 'SEQUENTIAL') {
            const sequentialChunks = await runSequentialSearch(roomId, docNameFilter);
            if (sequentialChunks.length > 0) {
                logger.info(SERVICE_NAME, `[PATH_B] Returning ${sequentialChunks.length} SEQUENTIAL chunks.`);
                // [CRITICAL FIX] Return object with mode suggestion
                return { chunks: sequentialChunks, suggestedMode: 'SEQUENTIAL' };
            }
            logger.warn(SERVICE_NAME, `[PATH_B] Sequential search empty. Falling back to Hybrid.`);
        }

        const queryEmbedding = await getEmbeddingForQuery(queryText);
        const [vectorRaw, keywordRaw] = await Promise.all([
            runVectorSearch(queryEmbedding, roomId, MAX_CHUNKS_FETCH, docNameFilter),
            runKeywordSearch(queryText, roomId, MAX_CHUNKS_FETCH, docNameFilter)
        ]);

        logger.info(SERVICE_NAME, `[PATH_A] Vector: ${vectorRaw.length}, Keyword: ${keywordRaw.length}`);
        
        const rankedRawChunks = applyRRF(vectorRaw, keywordRaw);
        const finalChunks = rankedRawChunks.slice(0, limit).map(row => {
            const methodLabel = row.methods.length > 1 ? 'Hybrid' : row.methods[0];
            return normalizeChunk(row, methodLabel, row.rrfScore);
        });

        // [CRITICAL FIX] Return object with mode suggestion
        return { chunks: finalChunks, suggestedMode: 'STANDARD' };

    } catch (error) {
        logger.error(SERVICE_NAME, `[FATAL] Retrieval failed:`, error);
        throw error;
    }
}

async function getDocumentList(roomId) {
    try {
        const res = await query('SELECT id, name FROM documents WHERE room_id = $1', [roomId]);
        return res.rows;
    } catch (err) { return []; }
}

module.exports = {
    getDocumentList,
    retrieveChunks: hybridRetrieveChunks,
    runKeywordSearch,
    runVectorSearch
};