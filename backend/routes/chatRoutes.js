// backend/routes/chatRoutes.js
// Updated File

const express = require('express');
const router = express.Router();
// --- MODIFIED LINE: Import all handlers including handleChatMessage ---
const {
    createConversation,
    getConversations,
    getConversationHistory,
    handleChatMessage
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

// --- NEW ROUTE START ---
// @route   POST /api/chat/message
// @desc    Send a message to a conversation and get a RAG response
// @access  Private
router.post('/message', protect, handleChatMessage);
// --- NEW ROUTE END ---

// --- [MODIFIED] Route now includes :roomId ---
// @route   POST /api/chat/new/:roomId
// @desc    Create a new empty conversation in a specific room
// @access  Private
router.post('/new/:roomId', protect, createConversation);

// --- [MODIFIED] Route now includes :roomId ---
// @route   GET /api/chat/conversations/:roomId
// @desc    Get all conversations for a specific room
// @access  Private
router.get('/conversations/:roomId', protect, getConversations);

// @route   GET /api/chat/history/:conversationId
// @desc    Get message history for a specific conversation
// @access  Private
router.get('/history/:conversationId', protect, getConversationHistory);

module.exports = router;