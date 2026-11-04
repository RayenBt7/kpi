const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const UserPermission = require('../models/UserPermission');
const { poolPromise, sql } = require('../config/database');

// GET /api/responsables - Get all responsables (filtered by permissions for non-admins)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Admin users see all responsables
        if (req.user.isAdmin) {
            const pool = await poolPromise;
            const result = await pool.request().query('SELECT * FROM dbo.responsable ORDER BY code_responsable');
            return res.json(result.recordset);
        }

        // Regular users see only responsables for indicateurs they have permission for
        const userPermissions = await UserPermission.getByUserId(req.user.id);
        
        if (userPermissions.length === 0) {
            return res.json([]);
        }

        // Extract unique indicateurs from permissions
        const allowedIndicateurs = [...new Set(userPermissions.map(p => p.indicateur))];
        
        // Create parameterized query for security
        const indicateurParams = allowedIndicateurs.map((_, index) => `@indicateur${index}`).join(',');
        
        const pool = await poolPromise;
        const request = pool.request();
        
        // Add indicateur parameters
        allowedIndicateurs.forEach((indicateur, index) => {
            request.input(`indicateur${index}`, sql.VarChar, indicateur);
        });
        
        const result = await request.query(`
            SELECT DISTINCT r.* 
            FROM dbo.responsable r
            WHERE r.indicateur IN (${indicateurParams})
            ORDER BY r.code_responsable
        `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching responsabilites:', error);
        res.status(500).json({ error: 'Failed to fetch responsabilites', details: error.message });
    }
});

// GET /api/responsables/:id - Get responsable by code_responsable (with permission check)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('code_responsable', sql.Int, id)
            .query('SELECT * FROM dbo.responsable WHERE code_responsable = @code_responsable');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Responsable not found' });
        }

        const responsable = result.recordset[0];

        // Admin users can access any responsable
        if (req.user.isAdmin) {
            return res.json(responsable);
        }

        // Regular users need permission for this responsable's indicateur
        const userPermissions = await UserPermission.getByUserId(req.user.id);
        const hasPermission = userPermissions.some(p => 
            p.indicateur === responsable.indicateur
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        res.json(responsable);
    } catch (error) {
        console.error('Error fetching responsable:', error);
        res.status(500).json({ error: 'Failed to fetch responsable', details: error.message });
    }
});

// POST /api/responsables - Create new responsable
router.post('/', authMiddleware, async (req, res) => {
    try {
        // Only admins can create responsables
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { indicateur, responsable, Pwd } = req.body;
        
        const pool = await poolPromise;
        
        // Get the next code_responsable value
        const maxResult = await pool.request().query('SELECT MAX(code_responsable) as maxCode FROM dbo.responsable');
        const nextCode = (maxResult.recordset[0].maxCode || 0) + 1;

        const result = await pool.request()
            .input('code_responsable', sql.Int, nextCode)
            .input('indicateur', sql.VarChar, indicateur || '')
            .input('responsable', sql.VarChar, responsable || '')
            .input('Pwd', sql.VarChar, Pwd || '')
            .query(`INSERT INTO dbo.responsable (code_responsable, indicateur, responsable, Pwd) 
                    VALUES (@code_responsable, @indicateur, @responsable, @Pwd);
                    SELECT * FROM dbo.responsable WHERE code_responsable = @code_responsable`);
        
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating responsable:', error);
        res.status(500).json({ error: 'Failed to create responsable', details: error.message });
    }
});

// PUT /api/responsables/:id - Update responsable
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        // Only admins can update responsables
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { id } = req.params;
        const { indicateur, responsable, Pwd } = req.body;
        
        const pool = await poolPromise;
        const result = await pool.request()
            .input('code_responsable', sql.Int, id)
            .input('indicateur', sql.VarChar, indicateur || '')
            .input('responsable', sql.VarChar, responsable || '')
            .input('Pwd', sql.VarChar, Pwd || '')
            .query(`UPDATE dbo.responsable 
                    SET indicateur = @indicateur, responsable = @responsable, Pwd = @Pwd
                    WHERE code_responsable = @code_responsable;
                    SELECT * FROM dbo.responsable WHERE code_responsable = @code_responsable`);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Responsable not found' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating responsable:', error);
        res.status(500).json({ error: 'Failed to update responsable', details: error.message });
    }
});

// PUT /api/responsables/action-responsable - Update responsable_action for an indicateur
router.put('/action-responsable', authMiddleware, async (req, res) => {
    try {
        // Only admins can update responsable_action
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { indicateur, responsable_action } = req.body;
        
        if (!indicateur) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }

        const pool = await poolPromise;
        
        // Check if a record exists for this indicateur
        const checkResult = await pool.request()
            .input('indicateur', sql.VarChar, indicateur)
            .query('SELECT * FROM dbo.responsable WHERE indicateur = @indicateur');

        if (checkResult.recordset.length === 0) {
            // Create new record with responsable_action
            const maxResult = await pool.request().query('SELECT MAX(code_responsable) as maxCode FROM dbo.responsable');
            const nextCode = (maxResult.recordset[0].maxCode || 0) + 1;

            const result = await pool.request()
                .input('code_responsable', sql.Int, nextCode)
                .input('indicateur', sql.VarChar, indicateur)
                .input('responsable_action', sql.VarChar, responsable_action || '')
                .query(`INSERT INTO dbo.responsable (code_responsable, indicateur, responsable_action) 
                        VALUES (@code_responsable, @indicateur, @responsable_action);
                        SELECT * FROM dbo.responsable WHERE code_responsable = @code_responsable`);
            
            return res.status(201).json(result.recordset[0]);
        }

        // Update existing record
        const result = await pool.request()
            .input('indicateur', sql.VarChar, indicateur)
            .input('responsable_action', sql.VarChar, responsable_action || '')
            .query(`UPDATE dbo.responsable 
                    SET responsable_action = @responsable_action
                    WHERE indicateur = @indicateur;
                    SELECT * FROM dbo.responsable WHERE indicateur = @indicateur`);
        
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating responsable_action:', error);
        res.status(500).json({ error: 'Failed to update responsable_action', details: error.message });
    }
});

// DELETE /api/responsables/:id - Delete responsable
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // Only admins can delete responsables
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { id } = req.params;
        const pool = await poolPromise;
        
        // Check if responsable exists
        const checkResult = await pool.request()
            .input('code_responsable', sql.Int, id)
            .query('SELECT * FROM dbo.responsable WHERE code_responsable = @code_responsable');
        
        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Responsable not found' });
        }

        await pool.request()
            .input('code_responsable', sql.Int, id)
            .query('DELETE FROM dbo.responsable WHERE code_responsable = @code_responsable');
        
        res.json({ message: 'Responsable deleted successfully' });
    } catch (error) {
        console.error('Error deleting responsable:', error);
        res.status(500).json({ error: 'Failed to delete responsable', details: error.message });
    }
});

module.exports = router;
