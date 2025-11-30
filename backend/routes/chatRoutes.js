// backend/routes/chatRoutes.js - OPTIMIZED with Delete and Fuzzy Search Routes

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../utils/logger'); // For atomic logging

logger.info('chatRoutes.js', 'Setting up chat routes...');

// --- NEW ROUTE: Chat History Search (Must be placed before parameterized routes) ---

// [NEW] GET /api/chat/search?q=searchTerm
// Searches chat history using pg_trgm fuzzy search across all user conversations.
router.get(
    '/search',
    protect,
    chatController.searchChatHistory
);


// --- Conversation Management Routes ---

// [NEW] GET /api/chat/:roomId
// Get all conversations for a user in a specific room
router.get(
    '/:roomId',
    protect,
    chatController.getConversations
);

// [NEW] POST /api/chat/:roomId/new
// Create a new, empty conversation in a room
router.post(
    '/:roomId/new',
    protect,
    chatController.createConversation
);

// [NEW] GET /api/chat/history/:conversationId
// Get the full message history for a single conversation
// Renamed the route segment for clarity and simplicity (dropped redundant :roomId segment)
router.get(
    '/history/:conversationId',
    protect,
    chatController.getConversationHistory
);

// --- Streaming Chat Query Route ---

// [MODIFIED] POST /api/chat/:roomId/:conversationId
// Post a new query to an existing conversation (ASYNCHRONOUS).
router.post(
    '/:roomId/:conversationId',
    protect,
    chatController.handleChatQuery
);

// --- NEW ROUTE: Delete Conversation ---

// [NEW] DELETE /api/chat/:conversationId
// Deletes a conversation and all history (ON DELETE CASCADE in Postgres).
router.delete(
    '/:conversationId',
    protect,
    chatController.deleteConversation
);


logger.info('chatRoutes.js', 'Chat routes configured successfully.');

module.exports = router;