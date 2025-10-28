const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    signup,
    login,
    logoutUser,
    getCurrentUser,
    googleLogin,
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

// Renamed registerUser to signup
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.post('/google', googleLogin);
router.post('/logout', logoutUser);
router.get('/me', protect, getCurrentUser);

// ---ROUTES---
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], forgotPassword);
router.get('/verify-email', handleEmailVerification);
router.get('/verification-status', checkVerificationStatus);
router.post('/reset-password', resetPasswordValidation, resetPassword);


module.exports = router;