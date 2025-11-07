const express = require('express');
const router = express.Router();
const {
    getRooms,
    createRoom,
    logRoomEntry,
    unblockRoom,
    joinRoom,
    getPendingRequests,
    approveRequest,
    rejectRequest,
    deleteDocument // [BUG_3_FIX] Import new controller function
} = require('../controllers/roomController');
// --- [TASK 9] Import authorize middleware ---
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing roomRoutes.js...');

// --- [TASK 9] Define reusable role groups ---
const canManageRooms = authorize('Administrator', 'ProductOwner', 'CTO');
const canManageRequests = authorize('Administrator', 'ProductOwner');
const isProductOwner = authorize('ProductOwner');
// --- [END TASK 9] ---


// @route   GET /api/rooms
// @desc    Get all chat rooms for the user's product
// @access  Private (All roles can view their own rooms)
router.get('/', protect, getRooms);

// @route   POST /api/rooms
// @desc    Create a new chat room (Admin, PO, CTO)
// @access  Private (Admin, ProductOwner, CTO)
router.post('/', protect, canManageRooms, createRoom);

// @route   POST /api/rooms/join/:roomId
// @desc    Checks if a user has permission to join a room (handles Admin/PO approvals)
// @access  Private (All roles can attempt to join)
router.post('/join/:roomId', protect, joinRoom);

// @route   POST /api/rooms/log-entry/:roomId
// @desc    Logs that a user has entered a room
// @access  Private (All roles log their own entry)
router.post('/log-entry/:roomId', protect, logRoomEntry);

// @route   PUT /api/rooms/unblock/:roomId
// @desc    Allows a PO to unblock a room assigned by a CTO
// @access  Private (ProductOwner only)
router.put('/unblock/:roomId', protect, isProductOwner, unblockRoom);

// --- [NEW] Routes for JIT Access Request Management ---
// @route   GET /api/rooms/requests/pending
// @desc    Gets all pending access requests for the logged-in user (owner)
// @access  Private (Admin, PO)
router.get('/requests/pending', protect, canManageRequests, getPendingRequests);

// @route   PUT /api/rooms/requests/approve/:requestId
// @desc    Approves a pending access request
// @access  Private (Admin, PO)
router.put('/requests/approve/:requestId', protect, canManageRequests, approveRequest);

// @route   PUT /api/rooms/requests/reject/:requestId
// @desc    Rejects a pending access request
// @access  Private (Admin, PO)
router.put('/requests/reject/:requestId', protect, canManageRequests, rejectRequest);
// --- [END NEW] ---

// --- [BUG_3_FIX] NEW Route for Document Deletion ---
// @route   DELETE /api/rooms/documents/:docId
// @desc    Deletes a document from SQLite, Chroma, and the file system
// @access  Private (Admin, PO, CTO)
router.delete('/documents/:docId', protect, canManageRooms, deleteDocument);
// --- [END BUG_3_FIX] ---

console.log('[ROUTES] roomRoutes.js initialized with full CRUD and JIT access routes.');

module.exports = router;