// backend/routes/roomRoutes.js

const express = require('express');
const router = express.Router();
const {
    getRooms,
    getRoomsForClient, // --- [BLOCK 6] NEW IMPORT ---
    createRoom,
    logRoomEntry,
    unblockRoom,
    joinRoom,
    deleteDocument,
    editRoomPassword 
} = require('../controllers/roomController');
// --- [TASK 9] Import authorize middleware ---
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing roomRoutes.js...');

// --- [TASK 9] Define reusable role groups ---
const canManageRooms = authorize('Administrator', 'ProductOwner', 'CTO');
const isProductOwner = authorize('ProductOwner');
// --- [BLOCK 6] NEW: Define role group for viewing hierarchy ---
const canViewHierarchy = authorize('Administrator', 'ProductOwner', 'CTO');


// @route   GET /api/rooms
// @desc    Get all chat rooms for a 'User' role (flat list)
// @access  Private (All roles can view their own rooms)
router.get('/', protect, getRooms);

// --- [BLOCK 6] NEW HIERARCHICAL DASHBOARD ROUTE ---
// @route   GET /api/rooms/client/:clientId
// @desc    Get all rooms for a specific client, with access level
// @access  Private (Admin, PO, CTO)
router.get('/client/:clientId', protect, canViewHierarchy, getRoomsForClient);
// --- [END BLOCK 6] ---

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

// --- [BUG_FIX] NEW Route for Password Editing ---
// @route   PUT /api/rooms/password/:roomId
// @desc    Allows a PO/Admin/CTO to edit a room's password
// @access  Private (Admin, ProductOwner, CTO)
router.put('/password/:roomId', protect, canManageRooms, editRoomPassword);
// --- [END BUG_FIX] ---

// --- [JIT_REFACTOR] Routes for JIT Access Request Management have been moved to jitRequestRoutes.js ---
console.log('[ROUTES] [JIT_REFACTOR] JIT routes (pending, approve, reject) removed from this file.');
// --- [END JIT_REFACTOR] ---

// --- [BUG_3_FIX] NEW Route for Document Deletion ---
// @route   DELETE /api/rooms/documents/:docId
// @desc    Deletes a document from SQLite, Chroma, and the file system
// @access  Private (Admin, PO, CTO)
router.delete('/documents/:docId', protect, canManageRooms, deleteDocument);
// --- [END BUG_3_FIX] ---

console.log('[ROUTES] roomRoutes.js initialized with CORE room routes.');

module.exports = router;