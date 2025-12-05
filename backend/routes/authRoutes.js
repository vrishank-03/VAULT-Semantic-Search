console.log('[LOG] Loading authRoutes.js...'); // V V IMP LOG
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    signup,
    signupAdmin,
    signupCto, // --- [TASK 5] NEW: Import signupCto
    login,
    logoutUser,
    getCurrentUser,
    // [FIX] Removed googleLogin from imports
    handleEmailVerification,
    checkVerificationStatus,
    forgotPassword,
    resetPassword 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// validation rules
const signupValidation = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)')
];

// --- [TASK 5] NEW: Validation for CTO Signup ---
const ctoSignupValidation = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)'),
    body('ctoSecret')
        .not().isEmpty().withMessage('CTO secret is required.')
];
// --- [END TASK 5] ---

const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email.').normalizeEmail(),
    body('password').not().isEmpty().withMessage('Password is required.')
];

const resetPasswordValidation = [
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)'),
    body('token').not().isEmpty().withMessage('Token is required.')
];

// --- All Signup Routes ---
router.post('/signup', signupValidation, signup);
router.post('/signup-admin', signupValidation, signupAdmin);
// --- [TASK 5] NEW: CTO Signup Route ---
router.post('/signup-cto', ctoSignupValidation, signupCto);
// --- [END TASK 5] ---


router.post('/login', loginValidation, login);
// [FIX] Removed the router.post('/google', ...) line
router.post('/logout', logoutUser);
router.get('/me', protect, getCurrentUser);

// --- Other Auth Routes ---
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], forgotPassword);
router.get('/verify-email', handleEmailVerification);
router.get('/verification-status', checkVerificationStatus);
router.post('/reset-password', resetPasswordValidation, resetPassword);


module.exports = router;