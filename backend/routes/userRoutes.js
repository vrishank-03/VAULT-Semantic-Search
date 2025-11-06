const express = require('express');
const router = express.Router();
const {
    getPendingUsers,
    approveUser,
    rejectUser,
    getTeam,
    getAllTeamMembers,
    deactivateUser,     // --- [TASK 10] NEW: Import
    reactivateUser,     // --- [TASK 10] NEW: Import
    getAdminsForProduct // --- [SIGNUP_FIX] NEW: Import
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing userRoutes.js...');

// --- [SIGNUP_FIX] NEW PUBLIC ROUTE ---
// This route must be public for the signup page to use.
// It is placed before the private routes.
// @route   GET /api/users/admins-for-product?productName=...
// @desc    Get all active admins for a given product
// @access  Public
router.get('/admins-for-product', getAdminsForProduct);
// --- [END SIGNUP_FIX] ---


// All routes in this file are for managers
const managerRoles = authorize('Administrator', 'ProductOwner', 'CTO');

// @route   GET /api/users/pending
// @desc    Get all users pending approval for the logged-in manager
// @access  Private
router.get('/pending', protect, managerRoles, getPendingUsers);

// @route   POST /api/users/approve/:userId
// @desc    Approve a pending user
// @access  Private
router.post('/approve/:userId', protect, managerRoles, approveUser);

// @route   DELETE /api/users/reject/:userId
// @desc    Reject and delete a pending user
// @access  Private
router.delete('/reject/:userId', protect, managerRoles, rejectUser);

// @route   GET /api/users/team
// @desc    Get all *active* team members for the manager
// @access  Private
router.get('/team', protect, managerRoles, getTeam);

// @route   GET /api/users/team/all
// @desc    Get *all* team members (all statuses) for the manager
// @access  Private
router.get('/team/all', protect, managerRoles, getAllTeamMembers);

// --- [TASK 10] NEW: Deactivate/Reactivate Routes ---

// @route   POST /api/users/deactivate/:userId
// @desc    Deactivate an active user by ID
// @access  Private
router.post('/deactivate/:userId', protect, managerRoles, deactivateUser);

// @route   POST /api/users/reactivate/:userId
// @desc    Reactivate a deactivated user by ID
// @access  Private
router.post('/reactivate/:userId', protect, managerRoles, reactivateUser);

// --- [END TASK 10] ---

console.log('[ROUTES] userRoutes.js initialized with full user management routes.');

module.exports = router;