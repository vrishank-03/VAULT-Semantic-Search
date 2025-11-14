// backend/searchService.js
// Refactored

const { performRAG } = require('./services/RAGPipelineService');
const { deleteDocumentVectors } = require('./services/VectorDBService');
const logger = require('./utils/logger');

// This file is now just a facade, re-exporting the modularized services.
// This ensures that any imports in other files (like routes) still work
// without needing to be changed.

// Note: The original `deleteDocumentFromChroma` has been renamed to `deleteDocumentVectors`
// in the VectorDBService for clarity. We export it under its new name.
// If routes import `deleteDocumentFromChroma`, we should export it as:
// deleteDocumentFromChroma: deleteDocumentVectors

logger.info('searchService.js', 'Module loaded. Exporting RAG and VectorDB functions.');

module.exports = {
    performRAG,
    deleteDocumentFromChroma: deleteDocumentVectors // Aliased for external compatibility
};