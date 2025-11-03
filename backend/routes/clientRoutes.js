const express = require('express');
const router = express.Router();
const {
    getClientsForAdmin,
    createClient
} = require('../controllers/clientController');
const { protect } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing clientRoutes.js...');

// @route   GET /api/clients
// @desc    Get all clients for the logged-in Admin's product
// @access  Private (Admin Only)
router.get('/', protect, getClientsForAdmin);

// @route   POST /api/clients
// @desc    Create a new client for the logged-in Admin's product
// @access  Private (Admin Only)
router.post('/', protect, createClient);

console.log('[ROUTES] clientRoutes.js initialized: GET / and POST / configured.');

module.exports = router;
