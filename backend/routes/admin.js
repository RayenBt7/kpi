const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const {
    getAllUsers,
    updateUserAdminStatus,
    updateUserType,
    deleteUser
} = require('../controllers/adminController');

// Protected admin routes - require both authentication and admin privileges
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.put('/users/:id/admin', authMiddleware, adminMiddleware, updateUserAdminStatus);
router.put('/users/:id/type', authMiddleware, adminMiddleware, updateUserType);
router.delete('/users/:id', authMiddleware, adminMiddleware, deleteUser);

// GET /api/admin/responsables - all rows from the responsable table
router.get('/responsables', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT
                r.code_responsable,
                r.indicateur,
                r.responsable,
                r.responsable_action,
                u.id AS user_id,
                u.user_type
            FROM dbo.responsable r
            LEFT JOIN dbo.users u ON LTRIM(RTRIM(u.username)) = LTRIM(RTRIM(r.responsable))
            ORDER BY r.responsable, r.indicateur
        `);
        res.json({ responsables: result.recordset });
    } catch (err) {
        console.error('Error fetching responsables:', err);
        res.status(500).json({ error: 'Failed to fetch responsables', details: err.message });
    }
});

module.exports = router;
