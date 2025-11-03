const express = require('express');
const router = express.Router();
const {
    getRooms,
    createRoom,
    logRoomEntry // --- [NEW] Import the new function
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing roomRoutes.js...');

// @route   GET /api/rooms
// @desc    Get all chat rooms for the user's product
// @access  Private
router.get('/', protect, getRooms);

// @route   POST /api/rooms
// @desc    Create a new chat room (Admin only)
// @access  Private
router.post('/', protect, createRoom);

// --- [NEW] Route for Audit Logging ---
// @route   POST /api/rooms/log-entry/:roomId
// @desc    Logs that a user has entered a room
// @access  Private
router.post('/log-entry/:roomId', protect, logRoomEntry);
// --- [END NEW] ---

console.log('[ROUTES] roomRoutes.js initialized: GET /, POST /, and POST /log-entry/:roomId configured.');

module.exports = router;
