// backend/services/RetrievalService.js
// --------------------------------------------------------
// [ROLE] Search Orchestrator
// [FIX] Fully hardened parameter handling & logging
// [FIX] Consistent use of MAX_CHUNKS_FETCH
// [FEAT] Smart fallback & Weighted Intent Detection
// --------------------------------------------------------

const { query } = require('../database');
const { getEmbeddingForQuery } = require('../ml_runner');
const { generateCompletion } = require('./GenerationService');
const VectorDBService = require('./VectorDBService'); 
const logger = require('../utils/logger');

const SERVICE_NAME = 'RetrievalService';
const MAX_CHUNKS_FETCH = 50;  // Limit for raw search
const MAX_CHUNKS_RETURN = 35; // Limit for final RRF fusion

// --- HELPER: Normalize DB Rows for Frontend ---
const normalizeChunk = (row, sourceMethod, score = 0) => {
    return {
        id: String(row.id || row.chunk_id), // Ensure string ID for consistency
        text: row.text || row.content || "",
        metadata: {
            documentId: row.document_id || row.metadata?.documentId,
            documentName: row.document_name || row.metadata?.documentName || "Unknown",
            pageNumber: row.page_number || row.metadata?.pageNumber || 1,
            
            // Hierarchy Context
            isHeader: row.is_header || row.metadata?.isHeader || false,
            parentId: row.parent_id || row.metadata?.parentId || null,
            
            source: sourceMethod,
            score: score,
            isVector: sourceMethod === 'Vector',
            isKeyword: sourceMethod === 'Keyword',
            isSequential: sourceMethod === 'Sequential'
        }
    };
};

// --- QUERY EXPANSION (Synonym Solver) ---
async function expandQuery(originalQuery) {
    if (originalQuery.split(' ').length > 8) return [originalQuery];

    try {
        const prompt = `
            AS AN AI SEARCH OPTIMIZER, GENERATE 3 DISTINCT SYNONYMS FOR THIS QUERY.
            RETURN ONLY A COMMA-SEPARATED LIST. NO INTRO.
            QUERY: "${originalQuery}"
        `;
        const expansion = await generateCompletion(prompt, 'FAST'); 
        const terms = expansion.split(',').map(t => t.trim().replace(/^"|"$/g, ''));
        return [...new Set([originalQuery, ...terms])];
    } catch (e) {
        return [originalQuery];
    }
}

// --- INTENT DETECTION (Weighted) ---
function detectQueryIntent(queryText, docNameFilter) {
    const lowerQuery = queryText.toLowerCase().trim();
    let score = 0;

    const strongPatterns = [
        /\b(summarize|summary|overview|synopsis|abstract|recap|digest)\b/i,
        /\b(tl;dr|tldr|briefing|run through|walk through)\b/i,
        /\b(entire|whole|full) document\b/i
    ];

    const mediumPatterns = [
        /\b(content|contents) of\b/i,
        /\b(cover|covers)\b/i, 
        /\b(about|regarding)\b$/i
    ];

    // Anti-patterns (Specific questions usually mean Hybrid)
    const antiPatterns = [
        /\bwhat is (a|an|the) [a-z]+\b/i,
        /\bhow (does|do|to|can)\b/i,
        /\b(specific|specifically)\b/i
    ];

    if (strongPatterns.some(p => p.test(lowerQuery))) score += 5;
    if (mediumPatterns.some(p => p.test(lowerQuery))) score += 3;
    if (antiPatterns.some(p => p.test(lowerQuery))) score -= 3;

    // Filter Bonus: If filtering by doc, slight bias to sequential
    if (docNameFilter) score += 2;

    logger.debug(SERVICE_NAME, `[INTENT] Score: ${score} (Query: "${lowerQuery}")`);
    return score >= 3 ? 'SEQUENTIAL' : 'HYBRID';
}

// --- STRATEGY A: SEQUENTIAL READING ---
async function runSequentialSearch(roomId, docNameFilter, limit = 60) {
    logger.info(SERVICE_NAME, `[STRATEGY] SEQUENTIAL for: ${docNameFilter || 'Room Context'}`);
    
    let sql = `
        SELECT dc.chunk_id, dc.content, dc.page_number, dc.document_id, d.name AS document_name, dc.is_header, dc.parent_id
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.room_id = $1
    `;
    const params = [roomId];
    
    if (docNameFilter) {
        sql += ` AND d.name ILIKE $${params.length + 1}`;
        params.push(`%${docNameFilter}%`);
    }
    
    // Dynamic param index for LIMIT
    sql += ` ORDER BY dc.page_number ASC, dc.id ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const res = await query(sql, params);
    return res.rows.map(row => normalizeChunk(row, 'Sequential', 1.0)); 
}

// --- STRATEGY B: VECTOR SEARCH (Delegated) ---
async function runVectorSearch(queryEmbedding, roomId, limit, docNameFilter = null) {
    let docIdFilter = null; // Explicit null for "no filter"

    // 1. Resolve Fuzzy Name -> Strict IDs
    if (docNameFilter) {
        try {
            const idRes = await query(
                `SELECT id FROM documents WHERE room_id = $1 AND name ILIKE $2`, 
                [roomId, `%${docNameFilter}%`]
            );
            if (idRes.rows.length > 0) {
                docIdFilter = idRes.rows.map(r => r.id);
                logger.debug(SERVICE_NAME, `[FILTER] Resolved "${docNameFilter}" to IDs: ${docIdFilter.join(',')}`);
            } else {
                logger.warn(SERVICE_NAME, `[FILTER] Document "${docNameFilter}" not found.`);
            }
        } catch (e) {
            logger.error(SERVICE_NAME, `[FILTER] Resolution failed`, e);
        }
    }
    
    // 2. Delegate to VectorDBService
    const results = await VectorDBService.queryByRoom(queryEmbedding, roomId, limit, docIdFilter);
    
    // 3. Adapter: Map Standard Object -> RRF-Ready Object
    return results.map(r => ({
        ...r,
        chunk_id: r.id,    // RRF expects 'chunk_id'
        content: r.text,   // RRF expects 'content'
        rank: 0            // Placeholder
    }));
}

// --- STRATEGY C: KEYWORD SEARCH (Hardened) ---
async function runKeywordSearch(expandedQueryString, roomId, limit, docNameFilter = null) {
    let whereClause = `WHERE dc.room_id = $2`;
    const params = [expandedQueryString, roomId]; 

    if (docNameFilter) {
        whereClause += ` AND d.name ILIKE $${params.length + 1}`;
        params.push(`%${docNameFilter}%`);
    }

    const sql = `
        SELECT dc.chunk_id, dc.content, dc.page_number, dc.document_id, d.name AS document_name, dc.is_header, dc.parent_id,
        similarity(dc.content, $1) AS raw_score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        ${whereClause}
        ORDER BY raw_score DESC
        LIMIT $${params.length + 1}
    `;
    
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
}

// --- FUSION: RRF ALGORITHM ---
function applyRRF(vectorResults, keywordResults, k = 60) {
    const scoreMap = new Map();
    const process = (row, type, rank) => {
        const id = row.chunk_id || row.id;
        const rrf = 1 / (k + rank);
        
        if (!scoreMap.has(id)) {
            scoreMap.set(id, { ...row, rrfScore: rrf, methods: [type] });
        } else {
            const entry = scoreMap.get(id);
            entry.rrfScore += rrf;
            if (!entry.methods.includes(type)) entry.methods.push(type);
        }
    };
    vectorResults.forEach((r, i) => process(r, 'Vector', i + 1));
    keywordResults.forEach((r, i) => process(r, 'Keyword', i + 1));
    return Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}

// --- MAIN ORCHESTRATOR ---
async function hybridRetrieveChunks(queryText, roomId, docNameFilter = null, limit = MAX_CHUNKS_RETURN) {
    logger.info(SERVICE_NAME, `[HYBRID] Retrieval Start.`);

    try {
        const intent = detectQueryIntent(queryText, docNameFilter);
        
        // PATH A: SEQUENTIAL
        if (intent === 'SEQUENTIAL') {
            const seq = await runSequentialSearch(roomId, docNameFilter);
            if (seq.length > 0) return { chunks: seq, suggestedMode: 'SEQUENTIAL' };
            
            logger.warn(SERVICE_NAME, `[FALLBACK] Sequential returned 0. Switching to Hybrid.`);
        }

        // PATH B: HYBRID
        // 1. Expand
        const expandedTerms = await expandQuery(queryText);
        const mainQuery = expandedTerms[0];
        const keywordQuery = expandedTerms.join(' ');

        // 2. Parallel Search
        const queryEmbedding = await getEmbeddingForQuery(mainQuery);
        
        const [vectorRaw, keywordRaw] = await Promise.all([
            runVectorSearch(queryEmbedding, roomId, MAX_CHUNKS_FETCH, docNameFilter),
            runKeywordSearch(keywordQuery, roomId, MAX_CHUNKS_FETCH, docNameFilter)
        ]);

        logger.info(SERVICE_NAME, `[RESULTS] Vector: ${vectorRaw.length}, Keyword: ${keywordRaw.length}`);

        // 3. Fuse
        const rankedRawChunks = applyRRF(vectorRaw, keywordRaw);
        
        const finalChunks = rankedRawChunks.slice(0, limit).map(row => {
            const methodLabel = row.methods.length > 1 ? 'Hybrid' : row.methods[0];
            return normalizeChunk(row, methodLabel, row.rrfScore);
        });

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