const express = require('express');
const router = express.Router();
// --- MODIFIED LINE: Added getConversations and getConversationHistory ---
const { createConversation, getConversations, getConversationHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware'); // Assuming the middleware function is 'protect'

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
// --- [END MODIFIED] ---

// --- NEW ROUTE START ---
// @route   GET /api/chat/history/:conversationId
// @desc    Get message history for a specific conversation
// @access  Private
router.get('/history/:conversationId', protect, getConversationHistory);
// --- NEW ROUTE END ---

module.exports = router;