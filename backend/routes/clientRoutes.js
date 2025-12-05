// backend/routes/clientRoutes.js

const express = require('express');
const router = express.Router();
const {
    getClients, // Renamed from getClientsForAdmin
    createClient,
    getAdminClientAssignments, // --- [BLOCK 5] NEW IMPORT ---
    updateAdminClientAssignments, // --- [BLOCK 5] NEW IMPORT ---
    getClientsForProduct // --- [BLOCK 6] NEW IMPORT ---
} = require('../controllers/clientController');
// --- [TASK 9] Import authorize middleware ---
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing clientRoutes.js...');

// --- [TASK 9] Define role group for client management ---
const canManageClients = authorize('Administrator', 'ProductOwner', 'CTO');
// --- [BLOCK 5] NEW: Define role group for client *assignment* ---
const canAssignClients = authorize('ProductOwner', 'CTO');
// --- [BLOCK 6] NEW: Define role group for viewing product/client hierarchy ---
const canViewHierarchy = authorize('Administrator', 'ProductOwner', 'CTO');


// @route   GET /api/clients
// @desc    Get all clients (for Create Room modal dropdown)
// @access  Private (Admin, ProductOwner, CTO)
router.get('/', protect, canManageClients, getClients); // Renamed function

// @route   POST /api/clients
// @desc    Create a new client for the logged-in manager's product
// @access  Private (Admin, ProductOwner, CTO)
router.post('/', protect, canManageClients, createClient);


// --- [BLOCK 6] NEW HIERARCHICAL DASHBOARD ROUTE ---

// @route   GET /api/clients/product/:productId
// @desc    Get all clients for a specific product, with access level
// @access  Private (Admin, ProductOwner, CTO)
router.get('/product/:productId', protect, canViewHierarchy, getClientsForProduct);

// --- [END BLOCK 6] ---


// --- [BLOCK 5] NEW CLIENT ASSIGNMENT ROUTES ---

// @route   GET /api/clients/assignments/:adminId
// @desc    Get assigned and available clients for a specific Admin
// @access  Private (ProductOwner, CTO)
router.get('/assignments/:adminId', protect, canAssignClients, getAdminClientAssignments);

// @route   PUT /api/clients/assignments/:adminId
// @desc    Update the clients assigned to a specific Admin
// @access  Private (ProductOwner, CTO)
router.put('/assignments/:adminId', protect, canAssignClients, updateAdminClientAssignments);

// --- [END BLOCK 5] ---

console.log('[ROUTES] clientRoutes.js initialized with all routes.');

module.exports = router;