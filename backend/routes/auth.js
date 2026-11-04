const express = require('express');
const {
    register,
    login,
    getAllUsers,
    getCurrentUser
} = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

router.get('/me', authMiddleware, getCurrentUser);
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);

module.exports = router;
