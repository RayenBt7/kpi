const User = require('../models/User');
const sql = require('mssql');
const { poolPromise } = require('../config/database');
const USER_TYPE_OPTIONS = ['user', 'responsable', 'pilote'];

// GET /api/admin/users - Get all users (admin only)
const getAllUsers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            WITH responsables AS (
                SELECT
                    LTRIM(RTRIM(responsable)) AS username,
                    MIN(responsable) AS responsable_name
                FROM dbo.responsable
                WHERE responsable IS NOT NULL
                  AND LTRIM(RTRIM(responsable)) <> ''
                GROUP BY LTRIM(RTRIM(responsable))
            )
            SELECT
                u.id,
                u.username,
                u.isAdmin,
                COALESCE(NULLIF(LTRIM(RTRIM(u.user_type)), ''), 'user') AS userType,
                r.responsable_name
            FROM dbo.users u
            LEFT JOIN responsables r
                ON r.username = LTRIM(RTRIM(u.username))
            ORDER BY u.id
        `);
        res.json({ users: result.recordset });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users', details: error.message });
    }
};

// PUT /api/admin/users/:id/admin - Update user admin status (admin only)
const updateUserAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin } = req.body;

        // Validate isAdmin is boolean
        if (typeof isAdmin !== 'boolean') {
            return res.status(400).json({ error: 'isAdmin must be a boolean value' });
        }

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent admin from removing their own admin status
        if (parseInt(id) === req.user.id && !isAdmin) {
            return res.status(400).json({ error: 'Cannot remove your own admin status' });
        }

        // Update admin status
        await User.updateAdminStatus(id, isAdmin);

        res.json({ 
            message: 'User admin status updated successfully',
            user: {
                id: user.id,
                username: user.username,
                isAdmin: isAdmin,
                userType: user.userType || 'user',
            }
        });
    } catch (error) {
        console.error('Error updating user admin status:', error);
        res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
};

// PUT /api/admin/users/:id/type - Update user type (admin only)
const updateUserType = async (req, res) => {
    try {
        const { id } = req.params;
        const nextType = String(req.body?.userType ?? '').trim().toLowerCase();

        if (!USER_TYPE_OPTIONS.includes(nextType)) {
            return res.status(400).json({ error: 'userType must be one of: user, responsable, pilote' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const oldType = user.user_type || 'user';
        const savedType = await User.updateUserType(id, nextType);

        const pool = await poolPromise;

        // If changing TO 'responsable', create entry in responsable table
        if (nextType === 'responsable') {
            try {
                // Check if user already has a row in responsable table
                const checkRes = await pool.request()
                    .input('responsable', sql.NVarChar, user.username)
                    .query(`SELECT TOP 1 code_responsable FROM dbo.responsable WHERE LTRIM(RTRIM(responsable)) = LTRIM(RTRIM(@responsable))`);

                if (checkRes.recordset.length === 0) {
                    // Get next auto-increment code
                    const maxResult = await pool.request().query('SELECT MAX(CAST(code_responsable AS INT)) as maxCode FROM dbo.responsable');
                    const nextCode = (maxResult.recordset[0]?.maxCode || 0) + 1;

                    // Insert new row with auto-increment code and username as name
                    await pool.request()
                        .input('code_responsable', sql.Int, nextCode)
                        .input('responsable', sql.NVarChar, user.username)
                        .query(`
                            INSERT INTO dbo.responsable (code_responsable, responsable)
                            VALUES (@code_responsable, @responsable)
                        `);
                }
            } catch (syncErr) {
                console.error('Warning: could not sync responsable table:', syncErr.message);
            }
        }
        // If changing FROM 'responsable' TO 'user' or 'pilote', delete from responsable table
        else if (oldType === 'responsable' && (nextType === 'user' || nextType === 'pilote')) {
            try {
                await pool.request()
                    .input('responsable', sql.NVarChar, user.username)
                    .query(`DELETE FROM dbo.responsable WHERE LTRIM(RTRIM(responsable)) = LTRIM(RTRIM(@responsable))`);
            } catch (syncErr) {
                console.error('Warning: could not remove responsable entry:', syncErr.message);
            }
        }

        res.json({
            message: 'User type updated successfully',
            user: {
                id: user.id,
                username: user.username,
                userType: savedType,
            },
        });
    } catch (error) {
        console.error('Error updating user type:', error);
        res.status(500).json({ error: 'Failed to update user type', details: error.message });
    }
};

// DELETE /api/admin/users/:id - Delete user (admin only)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent admin from deleting themselves
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        // Delete user
        await User.delete(id);

        res.json({ 
            message: 'User deleted successfully',
            deletedUser: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
};

module.exports = {
    getAllUsers,
    updateUserAdminStatus,
    updateUserType,
    deleteUser
};
