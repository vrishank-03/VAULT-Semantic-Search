// backend/services/VectorDBService.js
// --------------------------------------------------------
// [ROLE] Low-Level Database Accessor for Vectors
// [CRITICAL FIX] Replaced 'pgvector' operator (<->) with Pure SQL Math
// [OPTIMIZATION] Fetches Hierarchical Data (Parent/Header)
// --------------------------------------------------------

const { query, executeTransaction } = require('../database');
const logger = require('../utils/logger');
require('dotenv').config();

const SERVICE_NAME = 'VectorDBService';

/**
 * [PURE SQL] Euclidean Distance Formula
 * Calculates distance between two FLOAT8[] arrays without plugins.
 * Formula: sqrt(sum((a - b)^2))
 */
function buildEuclideanDistanceSQL(embeddingVector) {
    // Inject the vector as a literal array string. 
    // This is safe because 'embeddingVector' is a verified array of numbers from our ML service.
    const vectorStr = `ARRAY[${embeddingVector.join(',')}]::float8[]`;

    return `(
        SELECT sqrt(sum(power(a.val - b.val, 2)))
        FROM unnest(dc.embedding) WITH ORDINALITY AS a(val, i)
        JOIN unnest(${vectorStr}) WITH ORDINALITY AS b(val, i) ON a.i = b.i
    )`;
}

/**
 * Queries the document_chunks table using Pure SQL Math.
 * Returns Standardized RAG Objects.
 */
async function queryByRoom(queryEmbedding, roomId, nResults = 10, documentIdFilter = null) {
    logger.info(SERVICE_NAME, `[SEARCH] Querying room ${roomId} (Limit: ${nResults})`);
    
    // 1. Build Pre-Filter (The WHERE Clause)
    let whereClause = `WHERE dc.room_id = $1`;
    const params = [Number(roomId)];
    let paramIndex = 2; // Next param is $2

    // Optional: Filter by specific document IDs
    if (documentIdFilter && documentIdFilter.length > 0) {
        whereClause += ` AND dc.document_id = ANY($${paramIndex}::int[])`;
        params.push(documentIdFilter);
        paramIndex++;
    }

    // 2. Build Distance Formula
    // We construct the math formula dynamically using the input vector
    const distanceFormula = buildEuclideanDistanceSQL(queryEmbedding);

    const sql = `
        SELECT 
            dc.chunk_id,
            dc.content,
            dc.page_number,
            dc.document_id,
            d.name as document_name,
            
            -- [NEW] Hierarchical Fields
            dc.parent_id,
            dc.is_header,

            -- [FIX] Pure SQL Distance
            ${distanceFormula} AS distance
        FROM 
            document_chunks dc
        JOIN 
            documents d ON d.id = dc.document_id
        ${whereClause}
        ORDER BY 
            distance ASC
        LIMIT $${paramIndex}
    `;
    
    params.push(nResults); 

    try {
        const res = await query(sql, params);
        
        // 3. Map to Standard Output
        return res.rows.map(row => ({
            id: row.chunk_id,
            text: row.content,
            metadata: {
                documentId: row.document_id,
                documentName: row.document_name,
                pageNumber: row.page_number,
                distance: row.distance,
                
                // [NEW] Pass hierarchy up to the orchestrator
                parentId: row.parent_id,
                isHeader: row.is_header
            }
        }));

    } catch (error) {
        logger.error(SERVICE_NAME, `[FATAL] Vector Query Failed:`, error);
        throw new Error('VectorDB query failed.');
    }
}

/**
 * Deletes all vectors associated with a documentId.
 */
const deleteDocumentVectors = async (docId) => {
    logger.info(SERVICE_NAME, `[DELETE] Removing vectors for docId: ${docId}`);
    const sql = 'DELETE FROM document_chunks WHERE document_id = $1';
    
    try {
        const result = await executeTransaction(async (client) => {
            return await client.query(sql, [Number(docId)]);
        });
        return { success: true, deletedCount: result.rowCount };
    } catch (err) {
        logger.error(SERVICE_NAME, `[DELETE_FAIL] DocId ${docId}:`, err);
        return { success: false, deletedCount: 0, error: err.message };
    }
};

module.exports = {
    queryByRoom,
    deleteDocumentVectors
};