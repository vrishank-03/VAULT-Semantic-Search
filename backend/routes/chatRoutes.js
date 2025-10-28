const express = require('express');
const router = express.Router();
// --- MODIFIED LINE: Added getConversations and getConversationHistory ---
const { createConversation, getConversations, getConversationHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware'); // Assuming the middleware function is 'protect'

// @route   POST /api/chat/new
// @desc    Create a new empty conversation
// @access  Private
router.post('/new', protect, createConversation);

// @route   GET /api/chat/conversations
// @desc    Get all conversations for the logged-in user
// @access  Private
router.get('/conversations', protect, getConversations);

// --- NEW ROUTE START ---
// @route   GET /api/chat/history/:conversationId
// @desc    Get message history for a specific conversation
// @access  Private
router.get('/history/:conversationId', protect, getConversationHistory);
// --- NEW ROUTE END ---

module.exports = router;