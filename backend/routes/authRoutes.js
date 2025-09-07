const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    googleLogin // Import the new googleLogin controller
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Stricter validation rules
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

router.post('/signup', signupValidation, registerUser);
router.post('/login', loginValidation, loginUser);

// Route for Google Sign-In
router.post('/google', googleLogin);

router.post('/logout', logoutUser);
router.get('/me', protect, getCurrentUser);

module.exports = router;
