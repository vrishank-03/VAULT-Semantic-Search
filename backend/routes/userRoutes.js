const express = require('express');
const router = express.Router();
const {
    getPendingUsers,
    approveUser,
    rejectUser // --- [NEW] Import the new function
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing userRoutes.js...');

// @route   GET /api/users/pending
// @desc    Get all users pending approval for the admin/PO's product
// @access  Private (Admin or ProductOwner)
router.get('/pending', protect, getPendingUsers);

// @route   POST /api/users/approve/:userId
// @desc    Approve a pending user
// @access  Private (Admin or ProductOwner)
router.post('/approve/:userId', protect, approveUser);

// --- [NEW] Route to reject a user ---
// @route   DELETE /api/users/reject/:userId
// @desc    Reject and delete a pending user
// @access  Private (Admin or ProductOwner)
router.delete('/reject/:userId', protect, rejectUser);
// --- [END NEW] ---

console.log('[ROUTES] userRoutes.js initialized: GET /pending, POST /approve, and DELETE /reject configured.');

module.exports = router;