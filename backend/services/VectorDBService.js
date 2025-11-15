// backend/services/VectorDBService.js

const { ChromaClient } = require('chromadb');
const { getDb } = require('../database');
const logger = require('../utils/logger');
require('dotenv').config();

const SERVICE_NAME = 'VectorDBService';

const chromaClient = new ChromaClient({
    path: `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`,
});

/**
 * Queries the ChromaDB collection for relevant chunks.
 * @param {number[]} queryEmbedding - The embedding vector for the query.
 * @param {string|number} roomId - The room ID to filter by.
 * @param {number} nResults - The number of results to fetch.
 * @param {Array<string>|null} [documentFilter=null] - Optional list of document names to filter by.
 * @returns {Promise<object>} - The raw query results from Chroma.
 */
async function queryByRoom(queryEmbedding, roomId, nResults = 10, documentFilter = null) {
    logger.info(SERVICE_NAME, `Querying ChromaDB for room ${roomId} with ${nResults} results`);
    try {
        const collection = await chromaClient.getOrCreateCollection({ name: "documents" });

        // [CHROMA_SYNTAX_FIX] Build the dynamic 'where' filter
        let whereFilter;

        if (documentFilter && documentFilter.length > 0) {
            // If a document filter is provided, we *must* use an '$and' clause
            // to combine it with the roomId filter.
            logger.debug(SERVICE_NAME, `Applying document filter: ${documentFilter}`);
            whereFilter = {
                "$and": [
                    { "roomId": Number(roomId) },
                    { "documentName": { "$in": documentFilter } }
                ]
            };
        } else {
            // If no document filter, just filter by room (this is valid)
            whereFilter = {
                "roomId": Number(roomId)
            };
        }
        
        logger.debug(SERVICE_NAME, 'Using Chroma WHERE filter:', JSON.stringify(whereFilter));

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: nResults,
            where: whereFilter // Use the new, correct filter
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

        logger.debug(SERVICE_NAME, `Querying for vectors where documentId = ${docId}`);
        const results = await collection.get({
            where: { "documentId": Number(docId) },
            include: ["metadatas"] // We only need the IDs
        });

        if (!results || results.ids.length === 0) {
            logger.warn(SERVICE_NAME, `No vectors found in Chroma for docId: ${docId}. Nothing to delete.`);
            return { success: true, deletedCount: 0 };
        }

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
    chromaClient, 
    queryByRoom,
    deleteDocumentVectors
};