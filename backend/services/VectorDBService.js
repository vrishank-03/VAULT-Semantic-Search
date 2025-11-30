// backend/services/VectorDBService.js - FINAL FIX (Standardized Output)

const { query, executeTransaction } = require('../database');
const logger = require('../utils/logger');
require('dotenv').config();

const SERVICE_NAME = 'VectorDBService';

/**
 * Queries the document_chunks table using pgvector for relevant chunks.
 * Maps the output to the standardized format expected by promptTemplates.js.
 * @returns {Promise<Array<object>>} - [{ id, text, metadata: { documentName, pageNumber, documentId, distance } }]
 */
async function queryByRoom(queryEmbedding, roomId, nResults = 10, documentIdFilter = null) {
    logger.info(SERVICE_NAME, `[PGVECTOR] Querying for room ${roomId} with ${nResults} results`);
    
    // Convert embedding to PGVector string format: '[1.23, 0.45, ...]'
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    let whereClause = `WHERE dc.room_id = $2`;
    const params = [embeddingString, Number(roomId)];
    let paramIndex = 3;

    if (documentIdFilter && documentIdFilter.length > 0) {
        logger.debug(SERVICE_NAME, `Applying document ID filter: ${documentIdFilter.join(', ')}`);
        whereClause += ` AND dc.document_id = ANY($${paramIndex}::int[])`;
        params.push(documentIdFilter);
    }

    const sql = `
        SELECT 
            dc.chunk_id,
            dc.content,
            dc.page_number,
            dc.document_id,
            d.name as document_name,
            dc.embedding <-> $1 AS distance
        FROM 
            document_chunks dc
        JOIN 
            documents d ON d.id = dc.document_id
        ${whereClause}
        ORDER BY 
            distance
        LIMIT $${paramIndex}
    `;
    params.push(nResults); 

    try {
        const res = await query(sql, params);
        logger.info(SERVICE_NAME, `[PGVECTOR] Retrieved ${res.rows.length} chunks.`);
        
        // [CRITICAL FIX] Map Raw SQL -> Standard RAG Object
        // This aligns with what promptTemplates.js expects (chunk.text, chunk.metadata.documentName)
        return res.rows.map(row => ({
            id: row.chunk_id,
            text: row.content, // Map 'content' to 'text'
            metadata: {
                documentId: row.document_id,
                documentName: row.document_name, // Map 'document_name' to 'documentName'
                pageNumber: row.page_number,     // Map 'page_number' to 'pageNumber'
                distance: row.distance
            }
        }));

    } catch (error) {
        logger.error(SERVICE_NAME, `[PGVECTOR] Failed to query documents for room ${roomId}`, error);
        throw new Error('VectorDB query failed.');
    }
}

/**
 * Deletes all vectors associated with a documentId.
 */
const deleteDocumentVectors = async (docId) => {
    logger.info(SERVICE_NAME, `[PGVECTOR] Initiating vector deletion for docId: ${docId}`);
    const sql = 'DELETE FROM document_chunks WHERE document_id = $1';
    
    try {
        const result = await executeTransaction(async (client) => {
            return await client.query(sql, [Number(docId)]);
        });
        logger.info(SERVICE_NAME, `[PGVECTOR] Successfully deleted ${result.rowCount} vectors.`);
        return { success: true, deletedCount: result.rowCount };
    } catch (err) {
        logger.error(SERVICE_NAME, `[PGVECTOR] Failed to delete vectors for docId ${docId}:`, err);
        return { success: false, deletedCount: 0, error: err.message };
    }
};

module.exports = {
    queryByRoom,
    deleteDocumentVectors
};