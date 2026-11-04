const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const UserPermission = require('../models/UserPermission');
const sql = require('mssql');
const { poolPromise } = require('../config/database');

const normalizeText = (value) => String(value ?? '').trim();
const toNullableDate = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }

    return value;
};

const hasTextValue = (value) => normalizeText(value).length > 0;

const hasDateValue = (value) => {
    const normalized = toNullableDate(value);
    if (normalized === null) {
        return false;
    }

    if (normalized instanceof Date) {
        return !Number.isNaN(normalized.getTime());
    }

    if (typeof normalized === 'string') {
        return normalized.trim().length > 0;
    }

    return true;
};

const calculateConformityProgress = ({
    rootCause,
    action,
    responsable,
    dateclotprevu,
    datecreation,
    dateclot,
    efficacit,
}) => {
    if (!hasTextValue(rootCause) || !hasTextValue(action)) {
        return 0;
    }

    if (!hasTextValue(responsable)) {
        return 25;
    }

    if (!hasDateValue(dateclotprevu) || (!hasDateValue(datecreation) && !hasDateValue(dateclot))) {
        return 50;
    }

    if (!hasTextValue(efficacit)) {
        return 75;
    }

    return 100;
};

const hasIndicatorPermission = async (user, indicateur) => {
    if (user?.isAdmin) {
        return true;
    }

    const normalizedTarget = normalizeText(indicateur).toLowerCase();
    if (!normalizedTarget) {
        return false;
    }

    const userPermissions = await UserPermission.getByUserId(user.id);
    if (userPermissions.some((permission) => normalizeText(permission.indicateur).toLowerCase() === normalizedTarget)) {
        return true;
    }

    const username = normalizeText(user.username).toLowerCase();

    const pool = await poolPromise;
    const result = await pool.request()
        .input('indicateur', sql.NVarChar(255), normalizedTarget)
        .input('username', sql.NVarChar(255), username)
        .input('userId', sql.Int, user.id)
        .query(`
            SELECT TOP 1 1
            FROM dbo.indicator_assignments
            WHERE LOWER(NULLIF(LTRIM(RTRIM(indicateur)), '')) = @indicateur
              AND (
                    (LOWER(NULLIF(LTRIM(RTRIM(responsable_name)), '')) = @username)
                    OR (user_id = @userId)
                  )
            UNION
            SELECT TOP 1 1
            FROM dbo.responsable
            WHERE LOWER(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '')) = @indicateur
              AND LOWER(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '')) = @username
        `);

    return result.recordset.length > 0;
};

const findLatestActionByIndicator = async (pool, indicateur) => {
    const normalizedIndicator = normalizeText(indicateur);
    if (!normalizedIndicator) {
        return null;
    }

    const result = await pool.request()
        .input('indicateur', sql.NVarChar(255), normalizedIndicator)
        .query(`
            SELECT TOP 1 *
            FROM dbo.Plan_action
            WHERE NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') = @indicateur
            ORDER BY
                COALESCE(TRY_CONVERT(datetime, datecreation), TRY_CONVERT(datetime, GETDATE())) DESC,
                TRY_CONVERT(INT, annee) DESC,
                TRY_CONVERT(INT, mois) DESC
        `);

    return result.recordset[0] || null;
};

// GET /api/actions - Get all action plans (filtered by permissions for non-admins)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Admin users see all actions
        if (req.user.isAdmin) {
            const pool = await poolPromise;
            const result = await pool.request().query(`
                SELECT 
                    pa.*,
                    i.Processus AS processus_name,
                    i.Designation
                FROM dbo.Plan_action pa
                LEFT JOIN dbo.Indicateur i 
                    ON LTRIM(RTRIM(pa.Indicateur)) = LTRIM(RTRIM(i.Indicateur))
                ORDER BY pa.datecreation DESC
            `);
            return res.json(result.recordset);
        }

        // Regular users see actions for indicateurs they have permission for,
        // plus actions for indicateurs dont ils sont responsables.
        const userPermissions = await UserPermission.getByUserId(req.user.id);
        const allowedIndicateurs = new Set(userPermissions.map(p => normalizeText(p.indicateur)));

        const username = normalizeText(req.user.username);
        if (username) {
            const pool = await poolPromise;
            const normalizedUsername = username.toLowerCase();
            const assignedResult = await pool.request()
                .input('username', sql.NVarChar(255), normalizedUsername)
                .input('userId', sql.Int, req.user.id)
                .query(`
                    SELECT DISTINCT LTRIM(RTRIM(indicateur)) AS indicateur
                    FROM dbo.indicator_assignments
                    WHERE LOWER(NULLIF(LTRIM(RTRIM(responsable_name)), '')) = @username
                       OR user_id = @userId
                    UNION
                    SELECT DISTINCT LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))) AS indicateur
                    FROM dbo.responsable
                    WHERE LOWER(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '')) = @username
                `);

            assignedResult.recordset.forEach((row) => {
                if (row.indicateur) {
                    allowedIndicateurs.add(normalizeText(row.indicateur));
                }
            });
        }

        if (allowedIndicateurs.size === 0) {
            return res.json([]);
        }

        const allowedIndicateurArray = [...allowedIndicateurs];
        const indicateurParams = allowedIndicateurArray.map((_, index) => `@indicateur${index}`).join(',');

        const pool = await poolPromise;
        const request = pool.request();

        allowedIndicateurArray.forEach((indicateur, index) => {
            request.input(`indicateur${index}`, sql.VarChar, indicateur);
        });

        const result = await request.query(`
            SELECT 
                pa.*,
                i.Processus AS processus_name,
                i.Designation
            FROM dbo.Plan_action pa
            LEFT JOIN dbo.Indicateur i 
                ON LTRIM(RTRIM(pa.Indicateur)) = LTRIM(RTRIM(i.Indicateur))
            WHERE pa.Indicateur IN (${indicateurParams})
            ORDER BY pa.datecreation DESC
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching actions:', error);
        res.status(500).json({ error: 'Failed to fetch actions', details: error.message });
    }
});
// Get /api/actions/responsables - Get action plans by responsable (with permission check)
router.get('/responsables/:responsable', authMiddleware, async (req, res) => {
    try {
        const { responsable } = req.params;

        // Admin users can access any actions
        if (req.user.isAdmin) {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('responsable', sql.VarChar, responsable)
                .query('SELECT * FROM dbo.Plan_action WHERE responsable = @responsable ORDER BY datecreation DESC');

            return res.json(result.recordset);
        }

        // Regular users need permission for this responsable's indicateurs
        const pool = await poolPromise;
        const result = await pool.request()
            .input('responsable', sql.VarChar, responsable)
            .query(`
                        SELECT DISTINCT LTRIM(RTRIM(responsable)) AS responsable_name
            FROM [kpi].dbo.Plan_action
            WHERE responsable IS NOT NULL
            AND LTRIM(RTRIM(responsable)) <> ''
            ORDER BY responsable_name;
            `)
            .input('userId', sql.Int, req.user.id);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching actions by responsable:', error);
        res.status(500).json({ error: 'Failed to fetch actions', details: error.message });
    }
});

// GET /api/actions/indicateur/:indicateur - Get action plans by indicator (with optional year filter)
router.get('/indicateur/:indicateur', authMiddleware, async (req, res) => {
    try {
        const { indicateur } = req.params;
        const { year } = req.query; // Optional year parameter
        const currentYear = year || new Date().getFullYear();

        // Admin users can access any actions
        if (req.user.isAdmin) {
            const pool = await poolPromise;
            let query = 'SELECT * FROM dbo.Plan_action WHERE Indicateur = @indicateur';
            let request = pool.request().input('indicateur', sql.VarChar, indicateur);

            // Filter by year if provided
            if (year) {
                query += ' AND YEAR(datecreation) = @year';
                request = request.input('year', sql.Int, parseInt(year));
            }

            query += ' ORDER BY datecreation DESC';
            const result = await request.query(query);

            return res.json(result.recordset);
        }

        // Regular users need permission for this indicateur
        const canAccessIndicator = await hasIndicatorPermission(req.user, indicateur);
        if (!canAccessIndicator) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const pool = await poolPromise;
        let query = 'SELECT * FROM dbo.Plan_action WHERE Indicateur = @indicateur';
        let request = pool.request().input('indicateur', sql.VarChar, indicateur);

        // Filter by year if provided
        if (year) {
            query += ' AND YEAR(datecreation) = @year';
            request = request.input('year', sql.Int, parseInt(year));
        }

        query += ' ORDER BY datecreation DESC';
        const result = await request.query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching action plans:', error);
        res.status(500).json({ error: 'Failed to fetch action plans', details: error.message });
    }
});
// GET /api/actions/exists/:indicateur - Check if action plan exists for indicator/year/month
router.get('/exists/:indicateur', authMiddleware, async (req, res) => {
    try {
        const { indicateur } = req.params;
        const { year, mois } = req.query;
        
        const normalizedIndicator = normalizeText(indicateur);
        if (!normalizedIndicator) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }

        // Vérifier les permissions (utiliser la même logique que hasIndicatorPermission)
        const canAccess = await hasIndicatorPermission(req.user, normalizedIndicator);
        if (!canAccess && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const pool = await poolPromise;
        let query = 'SELECT TOP 1 Indicateur, annee, mois, PROGRESS, datecreation, responsable FROM dbo.Plan_action WHERE Indicateur = @indicateur';
        let request = pool.request().input('indicateur', sql.VarChar, normalizedIndicator);

        if (year) {
            query += ' AND annee = @year';
            request = request.input('year', sql.Int, parseInt(year));
        }

        if (mois) {
            query += ' AND mois = @mois';
            request = request.input('mois', sql.Int, parseInt(mois));
        }

        query += ' ORDER BY datecreation DESC';
        
        const result = await request.query(query);
        
        res.json({
            exists: result.recordset.length > 0,
            action: result.recordset[0] || null
        });
    } catch (error) {
        console.error('Error checking action existence:', error);
        res.status(500).json({ error: 'Failed to check action existence', details: error.message });
    }
});
// POST /api/actions - Create new action plan
router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            Indicateur, annee, mois, rootCause, action, responsable,
            dateclotprevu, dateclot, efficacit, datecreation
        } = req.body;

        const normalizedIndicator = normalizeText(Indicateur);
        if (!normalizedIndicator) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }

        const canCreateForIndicator = await hasIndicatorPermission(req.user, normalizedIndicator);
        if (!canCreateForIndicator) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        
        const effectiveYear = annee || new Date().getFullYear();
        const effectiveMonth = mois || new Date().getMonth() + 1;
        const effectiveRootCause = rootCause || '';
        const effectiveAction = action || '';
        const effectiveResponsable = responsable || '';
        const effectiveDateclotPrevu = toNullableDate(dateclotprevu);
        const effectiveDateclot = toNullableDate(dateclot);
        const effectiveDatecreation = toNullableDate(datecreation) || new Date();
        const effectiveEfficacit = efficacit || '';
        const progressInt = calculateConformityProgress({
            rootCause: effectiveRootCause,
            action: effectiveAction,
            responsable: effectiveResponsable,
            dateclotprevu: effectiveDateclotPrevu,
            datecreation: effectiveDatecreation,
            dateclot: effectiveDateclot,
            efficacit: effectiveEfficacit,
        });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Indicateur', sql.NVarChar(255), normalizedIndicator)
            .input('annee', sql.Int, effectiveYear)
            .input('mois', sql.Int, effectiveMonth)
            .input('rootCause', sql.NVarChar(sql.MAX), effectiveRootCause)
            .input('action', sql.NVarChar(sql.MAX), effectiveAction)
            .input('responsable', sql.NVarChar(255), effectiveResponsable)
            .input('dateclotprevu', sql.Date, effectiveDateclotPrevu)
            .input('dateclot', sql.Date, effectiveDateclot)
            .input('efficacit', sql.NVarChar(100), effectiveEfficacit)
            .input('datecreation', sql.Date, effectiveDatecreation)
            .input('PROGRESS_INT', sql.Int, progressInt)
            .query(`
                INSERT INTO dbo.Plan_action (Indicateur, annee, mois, rootCause, action, responsable, dateclotprevu, dateclot, efficacit, datecreation, PROGRESS)
                OUTPUT INSERTED.*
                VALUES (
                    @Indicateur,
                    @annee,
                    @mois,
                    @rootCause,
                    @action,
                    @responsable,
                    @dateclotprevu,
                    @dateclot,
                    @efficacit,
                    @datecreation,
                    @PROGRESS_INT
                );
            `);

        res.status(201).json(result.recordset[0] || { Indicateur: normalizedIndicator });
    } catch (error) {
        console.error('Error creating action:', error);
        res.status(500).json({ error: 'Failed to create action', details: error.message });
    }
});

// PUT /api/actions/:id - Update action plan
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            Indicateur, annee, mois, rootCause, action, responsable,
            dateclotprevu, dateclot, efficacit, datecreation
        } = req.body;

        const routeToken = normalizeText(id);
        const payloadIndicator = normalizeText(Indicateur);
        const targetIndicator = payloadIndicator || routeToken;

        if (!targetIndicator) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }

        const canUpdateIndicator = await hasIndicatorPermission(req.user, targetIndicator);
        if (!canUpdateIndicator) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const pool = await poolPromise;
        const targetAction = await findLatestActionByIndicator(pool, targetIndicator);

        if (!targetAction) {
            return res.status(404).json({ error: 'Action not found' });
        }

        const nextIndicator = payloadIndicator || normalizeText(targetAction.Indicateur);
        const effectiveAnnee = annee ?? targetAction.annee ?? new Date().getFullYear();
        const effectiveMois = mois ?? targetAction.mois ?? new Date().getMonth() + 1;
        const effectiveRootCause = rootCause ?? targetAction.rootCause ?? '';
        const effectiveAction = action ?? targetAction.action ?? '';
        const effectiveResponsable = responsable ?? targetAction.responsable ?? '';
        const effectiveDateclotPrevu =
            dateclotprevu === undefined ? toNullableDate(targetAction.dateclotprevu) : toNullableDate(dateclotprevu);
        const effectiveDateclot =
            dateclot === undefined ? toNullableDate(targetAction.dateclot) : toNullableDate(dateclot);
        const effectiveDatecreation =
            datecreation === undefined
                ? (toNullableDate(targetAction.datecreation) || new Date())
                : (toNullableDate(datecreation) || new Date());
        const effectiveEfficacit = efficacit ?? targetAction.efficacit ?? '';
        const progressInt = calculateConformityProgress({
            rootCause: effectiveRootCause,
            action: effectiveAction,
            responsable: effectiveResponsable,
            dateclotprevu: effectiveDateclotPrevu,
            datecreation: effectiveDatecreation,
            dateclot: effectiveDateclot,
            efficacit: effectiveEfficacit,
        });

        const result = await pool.request()
            .input('currentIndicator', sql.NVarChar(255), targetIndicator)
            .input('nextIndicator', sql.NVarChar(255), nextIndicator)
            .input('annee', sql.Int, effectiveAnnee)
            .input('mois', sql.Int, effectiveMois)
            .input('rootCause', sql.NVarChar(sql.MAX), effectiveRootCause)
            .input('action', sql.NVarChar(sql.MAX), effectiveAction)
            .input('responsable', sql.NVarChar(255), effectiveResponsable)
            .input('dateclotprevu', sql.Date, effectiveDateclotPrevu)
            .input('dateclot', sql.Date, effectiveDateclot)
            .input('efficacit', sql.NVarChar(100), effectiveEfficacit)
            .input('datecreation', sql.Date, effectiveDatecreation)
            .input('PROGRESS_INT', sql.Int, progressInt)
            .query(`UPDATE dbo.Plan_action 
                    SET Indicateur = @nextIndicator, annee = @annee, mois = @mois, rootCause = @rootCause, 
                        action = @action, responsable = @responsable, dateclotprevu = @dateclotprevu, 
                        dateclot = @dateclot, efficacit = @efficacit, datecreation = @datecreation, 
                        PROGRESS = @PROGRESS_INT
                    WHERE NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') = @currentIndicator;
                    SELECT TOP 1 *
                    FROM dbo.Plan_action
                    WHERE NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') = @nextIndicator
                    ORDER BY
                        COALESCE(TRY_CONVERT(datetime, datecreation), TRY_CONVERT(datetime, GETDATE())) DESC,
                        TRY_CONVERT(INT, annee) DESC,
                        TRY_CONVERT(INT, mois) DESC`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Action not found' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating action:', error);
        res.status(500).json({ error: 'Failed to update action', details: error.message });
    }
});

// DELETE /api/actions/:id - Delete action plan
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // Only admins can delete actions
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { id } = req.params;
        const indicatorKey = normalizeText(id);
        if (!indicatorKey) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }

        const pool = await poolPromise;

        // Check if action exists
        const checkResult = await pool.request()
            .input('indicateur', sql.NVarChar(255), indicatorKey)
            .query(`
                SELECT TOP 1 *
                FROM dbo.Plan_action
                WHERE NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') = @indicateur
            `);

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Action not found' });
        }

        await pool.request()
            .input('indicateur', sql.NVarChar(255), indicatorKey)
            .query(`
                DELETE FROM dbo.Plan_action
                WHERE NULLIF(LTRIM(RTRIM(CAST(Indicateur AS NVARCHAR(255)))), '') = @indicateur
            `);

        res.json({ message: 'Action deleted successfully' });
    } catch (error) {
        console.error('Error deleting action:', error);
        res.status(500).json({ error: 'Failed to delete action', details: error.message });
    }
});

module.exports = router;
