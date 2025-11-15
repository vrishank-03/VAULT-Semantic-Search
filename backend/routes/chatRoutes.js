// backend/routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../utils/logger'); // For atomic logging

logger.info('chatRoutes.js', 'Setting up chat routes...');

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

// [NEW] GET /api/chat/:roomId/:conversationId
// Get the full message history for a single conversation
router.get(
    '/:roomId/:conversationId',
    protect,
    chatController.getConversationHistory
);

// --- Streaming Chat Query Route ---

// [MODIFIED] POST /api/chat/:roomId/:conversationId
// Post a new query to an existing conversation.
// This is now ASYNCHRONOUS. It triggers the pipeline and returns 202.
// The actual response is sent via Socket.io.
router.post(
    '/:roomId/:conversationId',
    protect,
    chatController.handleChatQuery
);

logger.info('chatRoutes.js', 'Chat routes configured successfully.');

module.exports = router;