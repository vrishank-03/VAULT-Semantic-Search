const express = require('express');
const router = express.Router();
// --- [MODIFIED] Import the new approveProduct function ---
const { 
    requestProductCreation,
    getConfirmedProducts,
    approveProduct
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing productRoutes.js...');

// @route   POST /api/products/request-product
// @desc    Handles the request to create a new product (in a suspended state)
// @access  Public
router.post('/request-product', requestProductCreation);

// --- [NEW] Route to get confirmed products for signup ---
// @route   GET /api/products/confirmed
// @desc    Gets a list of all products with status = 'confirmed'
// @access  Public
router.get('/confirmed', getConfirmedProducts);
// --- [END NEW] ---

// --- [NEW] Route to approve a product ---
// @route   POST /api/products/approve/:productId
// @desc    Approves a product and activates the Product Owner
// @access  Private (for CTO/Admins)
router.post('/approve/:productId', protect, approveProduct);
// --- [END NEW] ---

console.log('[ROUTES] productRoutes.js initialized: POST /request-product, GET /confirmed, and POST /approve configured.');

module.exports = router;
