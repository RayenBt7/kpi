const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const UserPermission = require('../models/UserPermission');
const sql = require('mssql');
const { poolPromise } = require('../config/database');
const emailService = require('../services/emailService');

// Helper: check if user has permission for an indicator
const hasIndicateurPermission = async (userId, indicateur) => {
    const perms = await UserPermission.getByUserId(userId);
    return perms.some(p => p.indicateur === indicateur);
};

// GET /api/objectives - Get all objectives (filtered by permissions for non-admins)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;

        if (req.user.isAdmin) {
            const result = await pool.request().query('SELECT * FROM dbo.objectiv ORDER BY indicateur');
            return res.json(result.recordset);
        }

        const userPermissions = await UserPermission.getByUserId(req.user.id);
        if (userPermissions.length === 0) return res.json([]);

        const allowedIndicateurs = [...new Set(userPermissions.map(p => p.indicateur))];
        const indicateurParams = allowedIndicateurs.map((_, i) => `@indicateur${i}`).join(',');

        const request = pool.request();
        allowedIndicateurs.forEach((ind, i) => request.input(`indicateur${i}`, sql.VarChar, ind));

        const result = await request.query(`
            SELECT DISTINCT o.* 
            FROM dbo.objectiv o
            WHERE o.indicateur IN (${indicateurParams})
            ORDER BY o.indicateur
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching objectives:', error);
        res.status(500).json({ error: 'Failed to fetch objectives', details: error.message });
    }
});

// GET /api/objectives/indicateur/:indicateur - Get objectives by indicator
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
            .query('SELECT * FROM dbo.objectiv WHERE indicateur = @indicateur ORDER BY date1 DESC');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching objectives:', error);
        res.status(500).json({ error: 'Failed to fetch objectives', details: error.message });
    }
});

// POST /api/objectives - Create new objective
// Admins OR responsables (users with permission for the indicator) can create
router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            indicateur, janv, fev, mars, avril, mai, juin,
            juil, aout, sept, oct, nov, decem, date1, utilis, datenow, date_limite
        } = req.body;

        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const pool = await poolPromise;

        // Get next id
        const maxResult = await pool.request().query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM dbo.objectiv');
        const nextId = maxResult.recordset[0].nextId;

        await pool.request()
            .input('id', sql.Int, nextId)
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
            .input('date_limite', sql.Date, date_limite || null)
            .query(`
                INSERT INTO dbo.objectiv (id, indicateur, janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem, date1, utilis, datenow, date_limite)
                VALUES (@id, @indicateur, @janv, @fev, @mars, @avril, @mai, @juin, @juil, @aout, @sept, @oct, @nov, @decem, @date1, @utilis, @datenow, @date_limite)
            `);

        const selectResult = await pool.request()
            .input('id', sql.Int, nextId)
            .query('SELECT * FROM dbo.objectiv WHERE id = @id');

        res.status(201).json(selectResult.recordset[0] || { id: nextId });
    } catch (error) {
        console.error('Error creating objective:', error);
        res.status(500).json({ error: 'Failed to create objective', details: error.message });
    }
});

// PUT /api/objectives/:id - Update objective
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            indicateur, janv, fev, mars, avril, mai, juin,
            juil, aout, sept, oct, nov, decem, date1, utilis, datenow, date_limite
        } = req.body;

        // First check if record exists and get its indicateur
        const pool = await poolPromise;
        const checkResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM dbo.objectiv WHERE id = @id');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Objective not found' });
        }

        const existingIndicateur = indicateur || checkResult.recordset[0].indicateur;

        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, existingIndicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('indicateur', sql.VarChar, existingIndicateur || '')
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
            .input('date_limite', sql.Date, date_limite || null)
            .query(`
                UPDATE dbo.objectiv 
                SET indicateur=@indicateur, janv=@janv, fev=@fev, mars=@mars, avril=@avril,
                    mai=@mai, juin=@juin, juil=@juil, aout=@aout, sept=@sept, oct=@oct,
                    nov=@nov, decem=@decem, date1=@date1, utilis=@utilis, datenow=@datenow, date_limite=@date_limite
                WHERE id = @id;
                SELECT * FROM dbo.objectiv WHERE id = @id
            `);

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating objective:', error);
        res.status(500).json({ error: 'Failed to update objective', details: error.message });
    }
});

// DELETE /api/objectives/:id - Delete objective
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        const checkResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM dbo.objectiv WHERE id = @id');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Objective not found' });
        }

        const rec = checkResult.recordset[0];
        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, rec.indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM dbo.objectiv WHERE id = @id');

        res.json({ message: 'Objective deleted successfully' });
    } catch (error) {
        console.error('Error deleting objective:', error);
        res.status(500).json({ error: 'Failed to delete objective', details: error.message });
    }
});

// GET /api/objectives/deadlines/:indicateur?year=2026
router.get('/deadlines/:indicateur', authMiddleware, async (req, res) => {
    try {
        const { indicateur } = req.params;
        const { year } = req.query;
        const pool = await poolPromise;

        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied' });
        }

        let query = `SELECT * FROM dbo.objective_deadlines WHERE indicateur = @indicateur`;
        const request = pool.request().input('indicateur', sql.NVarChar, indicateur);

        if (year) {
            // For annual: period_key = year; for month/quarter: filter by created year or all
            // We store all deadlines regardless of year – return all and let frontend filter,
            // OR we add a year column. For now return all for this indicator.
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching deadlines:', err);
        res.status(500).json({ error: 'Failed to fetch deadlines', details: err.message });
    }
});

// POST /api/objectives/deadlines - upsert a single deadline
router.post('/deadlines', authMiddleware, async (req, res) => {
    try {
        const { indicateur, period_type, period_key, date_limite } = req.body;

        if (!indicateur || !period_type || !period_key) {
            return res.status(400).json({ error: 'indicateur, period_type and period_key are required' });
        }

        if (!req.user.isAdmin) {
            const ok = await hasIndicateurPermission(req.user.id, indicateur);
            if (!ok) return res.status(403).json({ error: 'Access denied' });
        }

        const pool = await poolPromise;

        // Find responsables who have permission for this indicator
        const responsablesRes = await pool.request()
            .input('indicateur', sql.NVarChar, indicateur)
            .query(`
                SELECT DISTINCT u.id, u.username, u.email
                FROM dbo.users u
                INNER JOIN dbo.user_permissions up ON up.user_id = u.id
                WHERE LTRIM(RTRIM(up.indicateur)) = LTRIM(RTRIM(@indicateur))
                  AND (u.isAdmin = 0 OR u.isAdmin IS NULL)
            `);

        const responsables = responsablesRes.recordset;
        // Use the first responsable's username, or fallback to the logged-in user
        const utilis = responsables.length > 0
            ? responsables.map(r => r.username).join(', ')
            : (req.user.username || '');

        // UPSERT: update if exists, insert if not
        const checkRes = await pool.request()
            .input('indicateur', sql.NVarChar, indicateur)
            .input('period_type', sql.NVarChar, period_type)
            .input('period_key', sql.NVarChar, period_key)
            .query(`SELECT id FROM dbo.objective_deadlines WHERE indicateur=@indicateur AND period_type=@period_type AND period_key=@period_key`);

        if (checkRes.recordset.length > 0) {
            await pool.request()
                .input('id', sql.Int, checkRes.recordset[0].id)
                .input('date_limite', sql.Date, date_limite || null)
                .input('utilis', sql.NVarChar, utilis)
                .query(`UPDATE dbo.objective_deadlines SET date_limite=@date_limite, utilis=@utilis WHERE id=@id`);
        } else {
            await pool.request()
                .input('indicateur', sql.NVarChar, indicateur)
                .input('period_type', sql.NVarChar, period_type)
                .input('period_key', sql.NVarChar, period_key)
                .input('date_limite', sql.Date, date_limite || null)
                .input('utilis', sql.NVarChar, utilis)
                .query(`INSERT INTO dbo.objective_deadlines (indicateur, period_type, period_key, date_limite, utilis) VALUES (@indicateur, @period_type, @period_key, @date_limite, @utilis)`);
        }

        // Send email notification to each responsable who has an email (fire-and-forget)
        if (date_limite && responsables.length > 0 && emailService.isConfigured()) {
            // Fetch designation from database
            const designationRes = await pool.request()
                .input('indicateur', sql.NVarChar, indicateur)
                .query(`SELECT TOP 1 Designation FROM dbo.Indicateur WHERE Indicateur = @indicateur`);
            const designation = designationRes.recordset[0]?.Designation?.trim() || indicateur;

            const periodLabel = period_type === 'year' ? `Année ${period_key}`
                : period_type === 'quarter' ? `Trimestre ${period_key.toUpperCase()}`
                : `Mois ${period_key}`;
            for (const r of responsables) {
                if (!r.email) continue;
                emailService.sendEmail({
                    to: r.email,
                    subject: `Objectif défini — ${designation} (${periodLabel})`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;border:1px solid #e5e7eb;border-radius:10px;">
                            <h2 style="color:#1d4ed8;">📋 Objectif défini pour votre indicateur</h2>
                            <p>Bonjour <strong>${r.username}</strong>,</p>
                            <p>Un objectif a été défini pour l'indicateur <strong>${designation}</strong>.</p>
                            <table style="border-collapse:collapse;width:100%;margin-top:12px;">
                                <tr><td style="padding:6px;font-weight:bold;">Indicateur</td><td style="padding:6px;">${designation}</td></tr>
                                <tr><td style="padding:6px;font-weight:bold;">Période</td><td style="padding:6px;">${periodLabel}</td></tr>
                                <tr><td style="padding:6px;font-weight:bold;">Date limite</td><td style="padding:6px;">${date_limite}</td></tr>
                            </table>
                            <p style="margin-top:16px;color:#6b7280;font-size:13px;">Connectez-vous sur AAF KPI pour consulter vos objectifs.</p>
                        </div>
                    `,
                }).catch(e => console.error('Email send error:', e));
            }
        }

        res.json({ success: true, utilis });
    } catch (err) {
        console.error('Error saving deadline:', err);
        res.status(500).json({ error: 'Failed to save deadline', details: err.message });
    }
});

module.exports = router;
