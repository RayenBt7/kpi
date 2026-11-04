const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
    forgotPassword,
    verifyResetToken,
    resetPassword,
    updateEmail,
} = require('../controllers/passwordResetController');

// Public routes (no auth required)
// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// GET /api/auth/verify-reset-token?token=xxx
router.get('/verify-reset-token', verifyResetToken);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// Protected route (requires login)
// PUT /api/auth/update-email
router.put('/update-email', authMiddleware, updateEmail);

module.exports = router;
