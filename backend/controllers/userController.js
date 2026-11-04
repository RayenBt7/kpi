const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');

// POST /api/auth/register - Register a new user
const register = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }

        // Check if username already exists
        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Create new user
        const newUser = await User.create({
            username,
            password
        });

        // Generate token
        const token = generateToken(newUser);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                isAdmin: newUser.isAdmin,
                userType: newUser.userType || newUser.user_type || 'user'
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
};

// POST /api/auth/login - Login with username and password
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required' 
            });
        }

        // Find user by username
        const user = await User.findByUsername(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await User.verifyPassword(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                isAdmin: user.isAdmin,
                userType: user.user_type || user.userType || 'user'
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed', details: error.message });
    }
};

// GET /api/auth/users - Get all users (protected)
const getAllUsers = async (req, res) => {
    try {
        const users = await User.getAll();
        res.json({ users });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users', details: error.message });
    }
};

// GET /api/auth/me - Get current user info (protected)
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({ error: 'Failed to get user', details: error.message });
    }
};

module.exports = {
    register,
    login,
    getAllUsers,
    getCurrentUser
};
