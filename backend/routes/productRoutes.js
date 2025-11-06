const express = require('express');
const router = express.Router();
const { 
    requestProductCreation,
    getConfirmedProducts,
    approveProduct,
    getPendingProducts, // [PHASE 1.C] Import new controller
    rejectProduct,      // [PHASE 1.C] Import new reject controller
    getAllProducts,     // [PHASE 1.D] Import new controller
    updateProduct       // [PHASE 1.D] Import new controller
} = require('../controllers/productController');
// --- [TASK 9] Import authorize middleware ---
const { protect, authorize } = require('../middleware/authMiddleware');

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

// --- [PHASE 1.D] NEW ROUTE ---
// @route   GET /api/products/all
// @desc    Gets ALL products for CTO management
// @access  Private (CTO Only)
router.get(
    '/all',
    protect,
    authorize('CTO'),
    getAllProducts
);
// --- [END NEW ROUTE] ---

// --- [PHASE 1.C] NEW ROUTE ---
// @route   GET /api/products/pending
// @desc    Gets all products awaiting CTO approval
// @access  Private (CTO Only)
router.get(
    '/pending',
    protect,
    authorize('CTO'),
    getPendingProducts
);
// --- [END NEW ROUTE] ---

// --- [TASK 9] Route to approve a product (NOW SECURED) ---
// @route   POST /api/products/approve/:productId
// @desc    Approves a product and activates the Product Owner
// @access  Private (CTO Only)
router.post(
    '/approve/:productId', 
    protect, 
    authorize('CTO'), // [TASK 9 ATOMIC LOG] Added authorize('CTO')
    approveProduct
);
// --- [END TASK 9] ---

// --- [PHASE 1.C] NEW REJECT ROUTE ---
// @route   DELETE /api/products/reject/:productId
// @desc    Rejects and deletes a pending product
// @access  Private (CTO Only)
router.delete(
    '/reject/:productId',
    protect,
    authorize('CTO'),
    rejectProduct
);
// --- [END NEW ROUTE] ---

// --- [PHASE 1.D] NEW UPDATE ROUTE ---
// @route   PUT /api/products/:productId
// @desc    Updates an existing product's details
// @access  Private (CTO Only)
router.put(
    '/:productId',
    protect,
    authorize('CTO'),
    updateProduct
);
// --- [END NEW ROUTE] ---


console.log('[ROUTES] productRoutes.js initialized: POST /request-product, GET /confirmed, GET /all, GET /pending, POST /approve, DELETE /reject, and PUT /:productId configured.');

module.exports = router;