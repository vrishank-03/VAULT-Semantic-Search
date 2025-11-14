// backend/services/VectorDBService.js
// New File

const { getDb, chromaClient } = require('../database'); // Assumes chromaClient is exported from database.js
const logger = require('../utils/logger');

const SERVICE_NAME = 'VectorDBService';

/**
 * Queries the ChromaDB collection for relevant chunks.
 * @param {number[]} queryEmbedding - The embedding vector for the query.
 * @param {string|number} roomId - The room ID to filter by.
 * @param {number} nResults - The number of results to fetch.
 * @returns {Promise<object>} - The raw query results from Chroma.
 */
async function queryByRoom(queryEmbedding, roomId, nResults = 10) {
    logger.info(SERVICE_NAME, `Querying ChromaDB for room ${roomId} with ${nResults} results`);
    try {
        const collection = await chromaClient.getOrCreateCollection({ name: "documents" });

        const whereFilter = {
            "roomId": Number(roomId) // Ensure roomId is a number
        };
        logger.debug(SERVICE_NAME, 'Using Chroma WHERE filter:', whereFilter);

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: nResults,
            where: whereFilter
        });

        logger.info(SERVICE_NAME, `ChromaDB retrieved ${results?.documents?.[0]?.length || 0} chunks`);
        return results;

    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to query ChromaDB for room ${roomId}`, error);
        throw new Error('VectorDB query failed.');
    }
}

/**
 * Deletes all vectors associated with a documentId from ChromaDB.
 * @param {string|number} docId - The document ID (from SQLite).
 * @returns {Promise<{success: boolean, deletedCount: number, error?: string}>}
 */
const deleteDocumentVectors = async (docId) => {
    logger.info(SERVICE_NAME, `Initiating Chroma vector deletion for docId: ${docId}`);
    try {
        const collection = await chromaClient.getOrCreateCollection({ name: "documents" });

        // 1. Find all vectors associated with this document ID.
        logger.debug(SERVICE_NAME, `Querying for vectors where documentId = ${docId}`);
        const results = await collection.get({
            where: { "documentId": Number(docId) },
            include: ["metadatas"] // We only need the IDs, this is efficient
        });

        if (!results || results.ids.length === 0) {
            logger.warn(SERVICE_NAME, `No vectors found in Chroma for docId: ${docId}. Nothing to delete.`);
            return { success: true, deletedCount: 0 };
        }

        // 2. Delete the found vectors by their unique IDs.
        logger.info(SERVICE_NAME, `Found ${results.ids.length} vectors. Deleting...`);
        await collection.delete({
            ids: results.ids
        });

        logger.info(SERVICE_NAME, `Successfully deleted ${results.ids.length} vectors for docId: ${docId}.`);
        return { success: true, deletedCount: results.ids.length };

    } catch (err) {
        logger.error(SERVICE_NAME, `Failed to delete vectors for docId ${docId}:`, err);
        return { success: false, deletedCount: 0, error: err.message };
    }
};

module.exports = {
    queryByRoom,
    deleteDocumentVectors
};