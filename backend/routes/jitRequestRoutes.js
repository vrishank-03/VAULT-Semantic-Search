// backend/routes/jitRequestRoutes.js

const express = require('express');
const router = express.Router();
const {
    getIncomingRequests, // Renamed from getPendingRequests
    approveRequest,
    rejectRequest,
    requestAccess,        // [JIT_FIX] NEW
    getOutgoingRequests,  // [JIT_FIX] NEW
    editRequest,          // [JIT_FIX] NEW
    revokeRequest,         // [JIT_FIX] NEW
    // --- [BLOCK 6] NEW PEER-TO-PEER IMPORTS ---
    requestPeerAccess,
    getIncomingPeerRequests,
    getOutgoingPeerRequests,
    respondToPeerRequest
} = require('../controllers/jitRequestController');
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] [JIT_REFACTOR] Initializing jitRequestRoutes.js...');

// Define reusable role groups
const canManageRequests = authorize('Administrator', 'ProductOwner', 'CTO');
// --- [BLOCK 6] NEW: Define role group for peer-to-peer requests ---
const canUsePeerJit = authorize('Administrator', 'ProductOwner');

// --- Routes for MANAGING incoming ROOM requests ---

// @route   GET /api/jit/incoming
// @desc    Gets all pending access requests for the logged-in user (owner)
// @access  Private (Admin, PO, CTO)
router.get('/incoming', protect, canManageRequests, getIncomingRequests);

// @route   PUT /api/jit/approve/:requestId
// @desc    Approves a pending access request
// @access  Private (Admin, PO, CTO)
router.put('/approve/:requestId', protect, canManageRequests, approveRequest);

// @route   PUT /api/jit/reject/:requestId
// @desc    Rejects a pending access request
// @access  Private (Admin, PO, CTO)
router.put('/reject/:requestId', protect, canManageRequests, rejectRequest);

// @route   PUT /api/jit/revoke/:requestId
// @desc    Revokes a previously approved (and active) access request
// @access  Private (Admin, PO, CTO)
router.put('/revoke/:requestId', protect, canManageRequests, revokeRequest);


// --- [JIT_FIX] Routes for CREATING/VIEWING your own ROOM requests ---

// @route   POST /api/jit/request-access
// @desc    Submit a new JIT request for a room using its code
// @access  Private (Any authenticated user)
router.post('/request-access', protect, requestAccess);

// @route   GET /api/jit/outgoing
// @desc    Gets all JIT requests *sent by* the logged-in user
// @access  Private (Any authenticated user)
router.get('/outgoing', protect, getOutgoingRequests);

// @route   PUT /api/jit/edit/:requestId
// @desc    Allows a requester to edit the time on their *pending* request
// @access  Private (Any authenticated user, controller verifies ownership)
router.put('/edit/:requestId', protect, editRequest);


// --- [BLOCK 6] NEW Peer-to-Peer JIT Routes ---

// @route   POST /api/jit/peer-request
// @desc    Submit a new JIT request for a Product (PO) or Client (Admin)
// @access  Private (ProductOwner, Administrator)
router.post('/peer-request', protect, canUsePeerJit, requestPeerAccess);

// @route   GET /api/jit/peer-incoming
// @desc    Gets all INCOMING peer JIT requests (Product/Client)
// @access  Private (ProductOwner, Administrator)
router.get('/peer-incoming', protect, canUsePeerJit, getIncomingPeerRequests);

// @route   GET /api/jit/peer-outgoing
// @desc    Gets all OUTGOING peer JIT requests (Product/Client)
// @access  Private (ProductOwner, Administrator)
router.get('/peer-outgoing', protect, canUsePeerJit, getOutgoingPeerRequests);

// @route   PUT /api/jit/peer-respond
// @desc    Approves, rejects, or revokes a peer JIT request
// @access  Private (ProductOwner, Administrator)
router.put('/peer-respond', protect, canUsePeerJit, respondToPeerRequest);

// --- [END BLOCK 6] ---

console.log('[ROUTES] [JIT_REFACTOR] jitRequestRoutes.js initialized with full JIT workflow.');

module.exports = router;