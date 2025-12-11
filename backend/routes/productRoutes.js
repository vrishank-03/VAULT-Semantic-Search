// backend/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
    requestProductCreation,
    getConfirmedProducts,
    approveProduct,
    getPendingProducts,
    rejectProduct,
    getAllProducts,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/authMiddleware');

console.log('[ROUTES] Initializing productRoutes.js...');

const isCTO = authorize('CTO');
// [CRITICAL FIX] Level 3 (Admin) is the base. PO (2) and CTO (1) are higher, so they pass.
const canViewProducts = authorize('Administrator', 'ProductOwner', 'CTO');

router.post('/request-product', requestProductCreation);
router.get('/confirmed', getConfirmedProducts);

// [CRITICAL FIX] This route now accepts POs and Admins
router.get('/all', protect, canViewProducts, getAllProducts);

router.get('/pending', protect, isCTO, getPendingProducts);
router.post('/approve/:productId', protect, isCTO, approveProduct);
router.delete('/reject/:productId', protect, isCTO, rejectProduct);
router.put('/:productId', protect, isCTO, updateProduct);
router.delete('/:productId', protect, isCTO, deleteProduct);

console.log('[ROUTES] productRoutes.js initialized with all routes.');
module.exports = router;