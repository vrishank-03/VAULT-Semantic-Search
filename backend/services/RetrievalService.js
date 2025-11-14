// backend/services/RetrievalService.js
// New File

const { getDb } = require('../database');
const { getEmbeddingForQuery } = require('../ml_runner'); // Stays as the embedding interface
const VectorDBService = require('./VectorDBService');
const logger = require('../utils/logger');

const SERVICE_NAME = 'RetrievalService';

// Helper for promise-based DB calls
const dbAll = (db, sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

/**
 * Fetches the list of documents available in a room.
 * @param {string|number} roomId - The room ID.
 * @returns {Promise<Array<object>>} - List of document {id, name}.
 */
async function getDocumentList(roomId) {
    logger.info(SERVICE_NAME, `Fetching document list for room ${roomId}`);
    const db = getDb();
    const sql = 'SELECT id, name FROM documents WHERE room_id = ? ORDER BY id DESC';
    try {
        const docs = await dbAll(db, sql, [roomId]);
        logger.info(SERVICE_NAME, `Found ${docs.length} documents in room ${roomId}.`);
        return docs;
    } catch (err) {
        logger.error(SERVICE_NAME, `Failed to fetch document list for room ${roomId}`, err);
        return []; // Return empty list on failure
    }
}

/**
 * Retrieves relevant chunks from ChromaDB based on a query.
 * @param {string} transformedQuery - The query from the GenerationService.
 * @param {string|number} roomId - The room ID.
 * @returns {Promise<object|null>} - The raw Chroma results, or null if no results.
 */
async function retrieveChunks(transformedQuery, roomId) {
    logger.info(SERVICE_NAME, 'Retrieving chunks for query...');
    try {
        // 1. Get embedding
        logger.debug(SERVICE_NAME, 'Getting embedding for transformed query...');
        const queryEmbedding = await getEmbeddingForQuery(transformedQuery);
        
        // 2. Query Vector DB
        const initialResults = await VectorDBService.queryByRoom(queryEmbedding, roomId, 10);

        // 3. Handle no results
        if (!initialResults || initialResults.documents.length === 0 || initialResults.documents[0].length === 0) {
            logger.warn(SERVICE_NAME, 'No relevant chunks found in ChromaDB for this query.');
            return null;
        }

        logger.info(SERVICE_NAME, `Retrieved ${initialResults.documents[0].length} initial chunks.`);
        
        // Re-format results into a more usable chunk array for re-ranking
        const chunks = initialResults.documents[0].map((doc, index) => {
            return {
                text: doc,
                metadata: initialResults.metadatas[0][index]
            };
        });
        
        return chunks;

    } catch (error) {
        logger.error(SERVICE_NAME, 'Failed during chunk retrieval process', error);
        throw new Error('Chunk retrieval failed.');
    }
}

module.exports = {
    getDocumentList,
    retrieveChunks,
};