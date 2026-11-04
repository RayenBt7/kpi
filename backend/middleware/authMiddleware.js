const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        
        if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Check if token starts with 'Bearer '
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7, authHeader.length) 
            : authHeader;

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Add user info to request
        req.user = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Function to generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            isAdmin: user.isAdmin,
            user_type: user.user_type || 'user',
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Middleware to check if user is admin
const adminMiddleware = (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = {
    authMiddleware,
    adminMiddleware,
    generateToken,
    JWT_SECRET
};
