const express = require('express');
const router = express.Router();
const {
    getClientsForAdmin,
    createClient
} = require('../controllers/clientController');
// --- [TASK 9] Import authorize middleware ---
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing clientRoutes.js...');

// --- [TASK 9] Define role group for client management ---
const canManageClients = authorize('Administrator', 'ProductOwner', 'CTO');

// @route   GET /api/clients
// @desc    Get all clients for the logged-in manager's product
// @access  Private (Admin, ProductOwner, CTO)
router.get('/', protect, canManageClients, getClientsForAdmin);

// @route   POST /api/clients
// @desc    Create a new client for the logged-in manager's product
// @access  Private (Admin, ProductOwner, CTO)
router.post('/', protect, canManageClients, createClient);

console.log('[ROUTES] clientRoutes.js initialized: GET / and POST / configured.');

module.exports = router;