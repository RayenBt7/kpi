const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const UserPermission = require('../models/UserPermission');
const sql = require('mssql');
const { poolPromise } = require('../config/database');

// Helper: check if user has permission for an indicator
const hasIndicateurPermission = async (userId, indicateur) => {
    const perms = await UserPermission.getByUserId(userId);
    return perms.some(p => p.indicateur === indicateur);
};

// GET /api/realises - Get all realized values (filtered by permissions for non-admins)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;

        if (req.user.isAdmin) {
            const result = await pool.request().query('SELECT * FROM dbo.realise ORDER BY indicateur');
            return res.json(result.recordset);
        }

        const userPermissions = await UserPermission.getByUserId(req.user.id);
        if (userPermissions.length === 0) return res.json([]);

        const allowedIndicateurs = [...new Set(userPermissions.map(p => p.indicateur))];
        const indicateurParams = allowedIndicateurs.map((_, i) => `@indicateur${i}`).join(',');

        const request = pool.request();
        allowedIndicateurs.forEach((ind, i) => request.input(`indicateur${i}`, sql.VarChar, ind));

        const result = await request.query(`
            SELECT DISTINCT r.* 
            FROM dbo.realise r
            WHERE r.indicateur IN (${indicateurParams})
            ORDER BY r.indicateur
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching realises:', error);
        res.status(500).json({ error: 'Failed to fetch realises', details: error.message });
    }
});

// GET /api/realises/indicateur/:indicateur - Get realized values by indicator
router.get('/indicateur/:indicateur', authMiddleware, async (req, res) => {
    try {
        const { indicateur } = req.params;
        const pool = await poolPromise;

        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const result = await pool.request()
            .input('indicateur', sql.VarChar, indicateur)
            .query('SELECT * FROM dbo.realise WHERE indicateur = @indicateur ORDER BY date1 DESC');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching realises:', error);
        res.status(500).json({ error: 'Failed to fetch realises', details: error.message });
    }
});

// POST /api/realises - Create new realized record
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { indicateur, janv, fev, mars, avril, mai, juin,
            juil, aout, sept, oct, nov, decem, date1, utilis, datenow, annuel, date_limite } = req.body;

        // Admins can create for any indicator; responsables only for their indicators
        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('indicateur', sql.VarChar, indicateur || '')
            .input('janv', sql.Decimal(18, 2), janv ?? null)
            .input('fev', sql.Decimal(18, 2), fev ?? null)
            .input('mars', sql.Decimal(18, 2), mars ?? null)
            .input('avril', sql.Decimal(18, 2), avril ?? null)
            .input('mai', sql.Decimal(18, 2), mai ?? null)
            .input('juin', sql.Decimal(18, 2), juin ?? null)
            .input('juil', sql.Decimal(18, 2), juil ?? null)
            .input('aout', sql.Decimal(18, 2), aout ?? null)
            .input('sept', sql.Decimal(18, 2), sept ?? null)
            .input('oct', sql.Decimal(18, 2), oct ?? null)
            .input('nov', sql.Decimal(18, 2), nov ?? null)
            .input('decem', sql.Decimal(18, 2), decem ?? null)
            .input('date1', sql.Date, date1 || null)
            .input('utilis', sql.VarChar, utilis || req.user.username || '')
            .input('datenow', sql.DateTime, datenow || new Date())
            .input('annuel', sql.Decimal(18, 2), annuel ?? null)
            .input('date_limite', sql.Date, date_limite || null)
            .query(`
                INSERT INTO dbo.realise (indicateur, janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem, date1, utilis, datenow, annuel, date_limite)
                VALUES (@indicateur, @janv, @fev, @mars, @avril, @mai, @juin, @juil, @aout, @sept, @oct, @nov, @decem, @date1, @utilis, @datenow, @annuel, @date_limite);
                SELECT SCOPE_IDENTITY() AS id
            `);

        const insertedId = result.recordset[0].id;
        const selectResult = await pool.request()
            .input('id', sql.Int, insertedId)
            .query('SELECT * FROM dbo.realise WHERE id = @id');

        res.status(201).json(selectResult.recordset[0] || { id: insertedId });
    } catch (error) {
        console.error('Error creating realise:', error);
        res.status(500).json({ error: 'Failed to create realise', details: error.message });
    }
});

// PUT /api/realises/:id - Update realized record
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { indicateur, janv, fev, mars, avril, mai, juin,
            juil, aout, sept, oct, nov, decem, date1, utilis, datenow, annuel, date_limite } = req.body;

        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('indicateur', sql.VarChar, indicateur || '')
            .input('janv', sql.Decimal(18, 2), janv ?? null)
            .input('fev', sql.Decimal(18, 2), fev ?? null)
            .input('mars', sql.Decimal(18, 2), mars ?? null)
            .input('avril', sql.Decimal(18, 2), avril ?? null)
            .input('mai', sql.Decimal(18, 2), mai ?? null)
            .input('juin', sql.Decimal(18, 2), juin ?? null)
            .input('juil', sql.Decimal(18, 2), juil ?? null)
            .input('aout', sql.Decimal(18, 2), aout ?? null)
            .input('sept', sql.Decimal(18, 2), sept ?? null)
            .input('oct', sql.Decimal(18, 2), oct ?? null)
            .input('nov', sql.Decimal(18, 2), nov ?? null)
            .input('decem', sql.Decimal(18, 2), decem ?? null)
            .input('date1', sql.Date, date1 || null)
            .input('utilis', sql.VarChar, utilis || req.user.username || '')
            .input('datenow', sql.DateTime, datenow || new Date())
            .input('annuel', sql.Decimal(18, 2), annuel ?? null)
            .input('date_limite', sql.Date, date_limite || null)
            .query(`
                UPDATE dbo.realise 
                SET indicateur=@indicateur, janv=@janv, fev=@fev, mars=@mars, avril=@avril,
                    mai=@mai, juin=@juin, juil=@juil, aout=@aout, sept=@sept, oct=@oct,
                    nov=@nov, decem=@decem, date1=@date1, utilis=@utilis, datenow=@datenow, annuel=@annuel, date_limite=@date_limite
                WHERE id = @id;
                SELECT * FROM dbo.realise WHERE id = @id
            `);

        if (result.recordset.length === 0) return res.status(404).json({ error: 'Realise not found' });
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating realise:', error);
        res.status(500).json({ error: 'Failed to update realise', details: error.message });
    }
});

// DELETE /api/realises/:id - Delete realized record
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const checkResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM dbo.realise WHERE id = @id');

        if (checkResult.recordset.length === 0) return res.status(404).json({ error: 'Realise not found' });

        const rec = checkResult.recordset[0];
        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, rec.indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM dbo.realise WHERE id = @id');

        res.json({ message: 'Realise deleted successfully' });
    } catch (error) {
        console.error('Error deleting realise:', error);
        res.status(500).json({ error: 'Failed to delete realise', details: error.message });
    }
});

module.exports = router;
