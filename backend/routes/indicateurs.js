const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const Indicateur = require('../models/Indicateur');
const UserPermission = require('../models/UserPermission');
const sql = require('mssql');
const { poolPromise } = require('../config/database');
const emailService = require('../services/emailService');

const MONTH_KEYS = ['janv', 'fev', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'decem'];
const MONTH_LABELS = { janv: 'Janvier', fev: 'Février', mars: 'Mars', avril: 'Avril', mai: 'Mai', juin: 'Juin', juil: 'Juillet', aout: 'Août', sept: 'Septembre', oct: 'Octobre', nov: 'Novembre', decem: 'Décembre' };

const toNumericValue = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const normalized = String(value)
        .trim()
        .replace(/%/g, '')
        .replace(/\s+/g, '')
        .replace(',', '.');

    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSign = (value) => {
    const sign = String(value ?? '').trim().replace(/\s+/g, '');

    if (!sign) return '';
    if (['>=', '=>', '≥', 'â‰¥'].includes(sign)) return '>=';
    if (['<=', '=<', '≤', 'â‰¤'].includes(sign)) return '<=';
    if (sign === '>') return '>';
    if (sign === '<') return '<';
    if (sign === '=') return '=';
    if (['!=', '<>', '≠', 'â‰ '].includes(sign)) return '!=';
    return '';
};

const isObjectiveMet = (realise, objective, signRaw) => {
    if (objective === null) {
        return null;
    }

    if (realise === null) {
        return false;
    }

    const sign = normalizeSign(signRaw);
    if (sign === '>=') return realise >= objective;
    if (sign === '<=') return realise <= objective;
    if (sign === '>') return realise > objective;
    if (sign === '<') return realise < objective;
    if (sign === '=') return Math.abs(realise - objective) < 0.0001;
    if (sign === '!=') return Math.abs(realise - objective) >= 0.0001;

    return null;
};

const evaluateNotificationStatus = (row) => {
    let pendingMonthCount = 0;
    let nullMounthCount = 0;
    const monthlyStatus = {};

    for (const month of MONTH_KEYS) {
        const objective = toNumericValue(row[`objective_${month}`]);
        const realise = toNumericValue(row[`realise_${month}`]);
        const monthLabel = MONTH_LABELS[month] || month;
        
        let status = 'ok';
        
        if (objective === null && realise === null) {
            status = 'pas_donnee';  // Pas d'objectif ET pas de valeur
        } else if (objective !== null && realise === null) {
            status = 'non_saisie';  // Objectif défini mais pas de valeur
            nullMounthCount++;
        } else if (objective !== null && realise !== null) {
            const met = isObjectiveMet(realise, objective, row.Signe);
            if (met === false) {
                status = 'non_atteint';
                pendingMonthCount++;
            }
            // else status remains 'ok'
        } else {
            status = 'pas_donnee';
        }
        
        monthlyStatus[month] = {
            label: monthLabel,
            status,
            objective,
            realise
        };
    }

    return {
        notificationStatus: pendingMonthCount > 0 || nullMounthCount > 0 ? 'pending' : 'ok',
        pendingMonthCount,
        nullMounthCount,
        hasActionPlan: pendingMonthCount > 0,
        monthlyStatus
    };
};

// GET /api/indicateurs - Get all indicators (filtered by permissions for non-admins)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Admin users see all indicateurs
        if (req.user.isAdmin) {
            const pool = await poolPromise;
            const result = await pool.request().query('SELECT * FROM dbo.Indicateur ORDER BY Nordre');
            return res.json(result.recordset);
        }

        // Regular users see only indicateurs they have permission for
        const userPermissions = await UserPermission.getByUserId(req.user.id);
        
        if (userPermissions.length === 0) {
            return res.json([]);
        }

        // Extract unique processus and indicateurs from permissions
        const allowedProcessus = [...new Set(userPermissions.map(p => p.processus))];
        const allowedIndicateurs = [...new Set(userPermissions.map(p => p.indicateur))];

        // Create parameterized query for security
        const processusParams = allowedProcessus.map((_, index) => `@processus${index}`).join(',');
        const indicateurParams = allowedIndicateurs.map((_, index) => `@indicateur${index}`).join(',');
        
        const pool = await poolPromise;
        const request = pool.request();
        
        // Add processus parameters
        allowedProcessus.forEach((processus, index) => {
            request.input(`processus${index}`, sql.VarChar, processus);
        });
        
        // Add indicateur parameters
        allowedIndicateurs.forEach((indicateur, index) => {
            request.input(`indicateur${index}`, sql.VarChar, indicateur);
        });
        
        const result = await request.query(`
            SELECT DISTINCT i.* 
            FROM dbo.Indicateur i
            WHERE (i.Processus IN (${processusParams}) OR i.Indicateur IN (${indicateurParams}))
            ORDER BY i.Nordre
        `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching indicateurs:', error);
        res.status(500).json({ error: 'Failed to fetch indicateurs', details: error.message });
    }
});

// GET /api/indicateurs/user-pending - Get user's pending/not realized indicators for profile
router.get('/user-pending', authMiddleware, async (req, res) => {
    try {
        // Get user's permissions
        const userPermissions = await UserPermission.getByUserId(req.user.id);
        
        if (userPermissions.length === 0) {
            return res.json({ indicateurs: [] });
        }

        // Extract unique processus and indicateurs from permissions
        const allowedProcessus = [...new Set(userPermissions.map(p => p.processus))];
        const allowedIndicateurs = [...new Set(userPermissions.map(p => p.indicateur))];

        // Create parameterized query for security
        const processusParams = allowedProcessus.map((_, index) => `@processus${index}`).join(',');
        const indicateurParams = allowedIndicateurs.map((_, index) => `@indicateur${index}`).join(',');
        
        const pool = await poolPromise;
        const request = pool.request();
        
        // Add processus parameters
        allowedProcessus.forEach((processus, index) => {
            request.input(`processus${index}`, sql.VarChar, processus);
        });
        
        // Add indicateur parameters
        allowedIndicateurs.forEach((indicateur, index) => {
            request.input(`indicateur${index}`, sql.VarChar, indicateur);
        });
        
        // Simplified query to get user's indicators with action plan status
        const result = await request.query(`
            SELECT
                LTRIM(RTRIM(i.Indicateur)) AS Indicateur,
                COALESCE(NULLIF(LTRIM(RTRIM(i.Processus)), ''), 'Sans processus') AS Processus,
                COALESCE(NULLIF(LTRIM(RTRIM(i.Designation)), ''), '-') AS Designation,
                CASE 
                    WHEN pa.id IS NOT NULL THEN 'pending'
                    ELSE 'ok'
                END AS notificationStatus,
                COALESCE(NULLIF(LTRIM(RTRIM(pa.efficacite)), ''), '0%') AS efficacite,
                COALESCE(NULLIF(LTRIM(RTRIM(CAST(pa.dateclotprevu AS NVARCHAR(100)))), ''), '') AS dateclotprevu
            FROM dbo.Indicateur i
            LEFT JOIN dbo.Plan_action pa 
                ON LTRIM(RTRIM(pa.Indicateur)) = LTRIM(RTRIM(i.Indicateur))
                AND pa.dateclot IS NULL
            WHERE (i.Processus IN (${processusParams}) OR i.Indicateur IN (${indicateurParams}))
            ORDER BY i.Processus, i.Nordre
        `);
        
        res.json({ indicateurs: result.recordset });
    } catch (error) {
        console.error('Error fetching user pending indicators:', error);
        res.status(500).json({ error: 'Failed to fetch user pending indicators', details: error.message });
    }
});

// GET /api/indicateurs/user-tasks - Get user's indicator tasks (MUST be before /:id)
router.get('/user-tasks', authMiddleware, async (req, res) => {
    try {
        const selectedYear = new Date().getFullYear();
        const pool = await poolPromise;
        
        // Get user type
        const userResult = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .query(`SELECT COALESCE(NULLIF(LTRIM(RTRIM(user_type)), ''), 'user') AS user_type FROM users WHERE id = @user_id`);
        const userType = userResult.recordset[0]?.user_type || 'user';
        
        const request = pool.request();
        request.input('user_id', sql.Int, req.user.id);
        request.input('selectedYear', sql.Int, selectedYear);
        request.input('isAdmin', sql.Bit, req.user.isAdmin ? 1 : 0);
        request.input('userType', sql.NVarChar(50), userType);
        request.input('username', sql.NVarChar(100), req.user.username);

        const result = await request.query(`
            SELECT DISTINCT
                TRY_CONVERT(INT, i.Nordre) AS Nordre,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS Indicateur,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), ''),
                    'Sans processus'
                ) AS processus,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Designation, CHAR(13), ''), CHAR(10), ''))), ''),
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), ''),
                    '-'
                ) AS Designation,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Signe, CHAR(13), ''), CHAR(10), ''))) AS Signe,
                ia.user_id AS utilisateur_id,
                u2.username AS utilisateur,
                ia.responsable_name AS responsable_name,
                ia.pilote_name AS pilote_name,
                oc.janv AS objective_janv,
                oc.fev AS objective_fev,
                oc.mars AS objective_mars,
                oc.avril AS objective_avril,
                oc.mai AS objective_mai,
                oc.juin AS objective_juin,
                oc.juil AS objective_juil,
                oc.aout AS objective_aout,
                oc.sept AS objective_sept,
                oc.oct AS objective_oct,
                oc.nov AS objective_nov,
                oc.decem AS objective_decem,
                rc.janv AS realise_janv,
                rc.fev AS realise_fev,
                rc.mars AS realise_mars,
                rc.avril AS realise_avril,
                rc.mai AS realise_mai,
                rc.juin AS realise_juin,
                rc.juil AS realise_juil,
                rc.aout AS realise_aout,
                rc.sept AS realise_sept,
                rc.oct AS realise_oct,
                rc.nov AS realise_nov,
                rc.decem AS realise_decem,
                CASE
                    WHEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') IS NULL THEN 1
                    ELSE 0
                END AS sort_processus_is_empty,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))) AS sort_processus,
                CASE WHEN TRY_CONVERT(INT, i.Nordre) IS NULL THEN 1 ELSE 0 END AS sort_nordre_is_empty,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS sort_indicateur
            FROM dbo.Indicateur AS i
            LEFT JOIN dbo.user_permissions AS up
                ON up.user_id = @user_id
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
            OUTER APPLY (
                SELECT TOP 1 ia.user_id, ia.responsable_name, ia.pilote_name
                FROM dbo.indicator_assignments AS ia
                WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ia.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ia.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
            ) AS ia
            LEFT JOIN dbo.users AS u2 ON u2.id = ia.user_id
            OUTER APPLY (
                SELECT TOP 1 o.*
                FROM dbo.objectiv AS o
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(o.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND YEAR(COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow))) = @selectedYear
                ORDER BY
                    COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow)) DESC,
                    TRY_CONVERT(datetime, o.datenow) DESC
            ) AS oc
            OUTER APPLY (
                SELECT TOP 1 r.*
                FROM dbo.realise AS r
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND YEAR(COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow))) = @selectedYear
                ORDER BY
                    COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow)) DESC,
                    TRY_CONVERT(datetime, r.datenow) DESC
            ) AS rc
            LEFT JOIN dbo.users AS u ON u.id = @user_id
            WHERE 
                (@isAdmin = 1) OR 
                (@userType = 'responsable' AND ia.responsable_name = @username) OR
                (@userType = 'pilote' AND ia.pilote_name = @username) OR
                (@userType = 'user' AND up.user_id IS NOT NULL)
            ORDER BY
                sort_processus_is_empty,
                sort_processus,
                sort_nordre_is_empty,
                Nordre,
                sort_indicateur;
        `);

        const indicateurList = result.recordset.map(r => r.Indicateur);

        // Fetch deadlines for these indicators
        let deadlineMap = {};
        if (indicateurList.length > 0) {
            const pool2 = await poolPromise;
            const inParams = indicateurList.map((_, i) => `@ind${i}`).join(',');
            const req2 = pool2.request();
            indicateurList.forEach((ind, i) => req2.input(`ind${i}`, sql.NVarChar, ind));
            const dlResult = await req2.query(`
                SELECT indicateur, MIN(date_limite) AS earliest_deadline, COUNT(*) AS deadline_count
                FROM dbo.objective_deadlines
                WHERE indicateur IN (${inParams}) AND date_limite IS NOT NULL
                GROUP BY indicateur
            `);
            dlResult.recordset.forEach(d => {
                deadlineMap[d.indicateur] = {
                    earliest_deadline: d.earliest_deadline,
                    deadline_count: d.deadline_count,
                };
            });
        }

        const indicateurs = result.recordset.map((row) => {
            const { notificationStatus, pendingMonthCount, nullMounthCount, hasActionPlan, monthlyStatus } = evaluateNotificationStatus(row);
            const dl = deadlineMap[row.Indicateur] || null;
            const task = {
                Indicateur: row.Indicateur,
                processus: row.processus,
                Designation: row.Designation,
                notificationStatus,
                pendingMonthCount,
                nullMounthCount,
                hasActionPlan,
                monthlyStatus,
                hasDeadline: !!dl,
                earliest_deadline: dl ? dl.earliest_deadline : null,
                deadline_count: dl ? dl.deadline_count : 0,
            };
            
            // If user is responsable, add utilisateur field from indicator_assignments
            if (userType === 'responsable') {
                task.utilisateur = row.utilisateur || '';
            }
            
            return task;
        });

        res.json({ 
            indicateurs,
            isAdmin: req.user.isAdmin,
            user_type: userType
        });
    } catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ error: 'Failed to fetch user tasks', details: error.message });
    }
});

// POST /api/indicateurs/notify - Send email notification for pending indicators
router.post('/notify', authMiddleware, async (req, res) => {
    try {
        const { indicateur, processus } = req.body;
        
        if (!indicateur) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }
        
        const pool = await poolPromise;
        
        // Get user type from JWT token or database
        const userType = req.user.user_type || req.user.userType || 'user';
        const username = req.user.username;
        
        console.log('Notification request - user:', req.user.id, 'userType:', userType, 'isAdmin:', req.user.isAdmin);
        
        // Allow any authenticated user to send notifications for testing
        // In production, uncomment the following check:
        // if (userType !== 'responsable' && userType !== 'pilote' && !req.user.isAdmin) {
        //     return res.status(403).json({ error: 'Seuls les responsables ou pilotes peuvent envoyer des notifications' });
        // }
        
        // Get the user assigned to this indicator (from indicator_assignments or responsable table)
        console.log('Looking for user with indicator:', indicateur);
        
        // First try indicator_assignments
        let assignmentResult = await pool.request()
            .input('indicateur', sql.NVarChar, indicateur)
            .query(`
                SELECT TOP 1 ia.user_id, u.username, u.email ,i.designation
                FROM dbo.indicator_assignments ia
                LEFT JOIN dbo.users u ON u.id = ia.user_id
                LEFT JOIN dbo.indicateur i ON i.indicateur = ia.indicateur
                WHERE NULLIF(LTRIM(RTRIM(ia.indicateur)), '') = NULLIF(LTRIM(RTRIM(@indicateur)), '')
            `);
        
        console.log('Indicator assignments result:', assignmentResult.recordset);
        
        let assignedUser = assignmentResult.recordset[0];
        
        // If no result from indicator_assignments, try responsable table
        if (!assignedUser) {
            console.log('No assignment found, trying responsable table');
            const responsableResult = await pool.request()
                .input('indicateur', sql.NVarChar, indicateur)
                .query(`
                    SELECT responsable AS username
                    FROM dbo.responsable
                    WHERE NULLIF(LTRIM(RTRIM(indicateur)), '') = NULLIF(LTRIM(RTRIM(@indicateur)), '')
                `);
            
            console.log('Responsable result:', responsableResult.recordset);
            
            if (responsableResult.recordset[0]) {
                assignedUser = responsableResult.recordset[0];
            }
        }
        
        console.log('Assigned user after lookup:', assignedUser);
        
        // If we found a username but no email, try to get email from users table
        if (assignedUser && assignedUser.username && !assignedUser.email) {
            console.log('No email found, looking up in users table for:', assignedUser.username);
            const emailResult = await pool.request()
                .input('username', sql.NVarChar, assignedUser.username)
                .query(`SELECT email FROM users WHERE LTRIM(RTRIM(username)) = LTRIM(RTRIM(@username))`);
            console.log('Email lookup result:', emailResult.recordset);
            if (emailResult.recordset[0]?.email) {
                assignedUser.email = emailResult.recordset[0].email;
            }
        }
        
        if (!assignedUser) {
            return res.status(404).json({ error: 'Aucun utilisateur trouvé pour cet indicateur' });
        }
        
        if (!assignedUser.email) {
            return res.status(404).json({ error: 'L\'utilisateur n\'a pas d\'email défini' });
        }
        
        // Get indicator details and pending months
        const indicatorResult = await pool.request()
            .input('indicateur', sql.NVarChar, indicateur)
            .query(`
                SELECT i.*, 
                    od.earliest_deadline, od.deadline_count
                FROM dbo.Indicateur i
                LEFT JOIN (
                    SELECT indicateur, MIN(date_limite) AS earliest_deadline, COUNT(*) AS deadline_count
                    FROM dbo.objective_deadlines
                    WHERE date_limite IS NOT NULL
                    GROUP BY indicateur
                ) od ON LTRIM(RTRIM(od.indicateur)) = LTRIM(RTRIM(i.Indicateur))
                WHERE LTRIM(RTRIM(i.Indicateur)) = LTRIM(RTRIM(@indicateur))
            `);
        
        const indicator = indicatorResult.recordset[0];
        if (!indicator) {
            return res.status(404).json({ error: 'Indicator not found' });
        }
        
        // Get current year objectives and realise
        const currentYear = new Date().getFullYear();
        const objResult = await pool.request()
            .input('indicateur', sql.NVarChar, indicateur)
            .input('year', sql.Int, currentYear)
            .query(`
                SELECT TOP 1 * FROM dbo.objectiv 
                WHERE LTRIM(RTRIM(indicateur)) = LTRIM(RTRIM(@indicateur))
                AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                ORDER BY COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow)) DESC
            `);
        
        const realiseResult = await pool.request()
            .input('indicateur', sql.NVarChar, indicateur)
            .input('year', sql.Int, currentYear)
            .query(`
                SELECT TOP 1 * FROM dbo.realise 
                WHERE LTRIM(RTRIM(indicateur)) = LTRIM(RTRIM(@indicateur))
                AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                ORDER BY COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow)) DESC
            `);
        
        const objective = objResult.recordset[0];
        const realise = realiseResult.recordset[0];
        
        // Calculate pending months
        let pendingMonths = [];
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const monthKeys = ['janv', 'fev', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'decem'];
        
        for (let i = 0; i < monthKeys.length; i++) {
            const month = monthKeys[i];
            const objValue = objective ? toNumericValue(objective[month]) : null;
            if (objValue !== null) {
                const realValue = realise ? toNumericValue(realise[month]) : null;
                const isMet = realValue !== null && realValue >= objValue;
                if (!isMet) {
                    pendingMonths.push({
                        month: monthNames[i],
                        objective: objValue,
                        realisation: realValue
                    });
                }
            }
        }
        
        if (!emailService.isConfigured()) {
            return res.status(500).json({ error: 'Email non configure. Veuillez configurer EMAIL_PROVIDER avec SMTP ou Resend dans le fichier .env' });
        }
        
        console.log('Sending email to:', assignedUser.email);
        
        const deadlineText = indicator.earliest_deadline 
            ? new Date(indicator.earliest_deadline).toLocaleDateString('fr-FR')
            : 'Non définie';
        
        const pendingListHtml = pendingMonths.length > 0 
            ? pendingMonths.map(pm => `<tr><td style="padding:6px;">${pm.month}</td><td style="padding:6px;">${pm.objective}</td><td style="padding:6px;">${pm.realisation !== null ? pm.realisation : 'Non enregistré'}</td></tr>`).join('')
            : '<tr><td colspan="3" style="padding:6px;">Aucun mois en attente</td></tr>';
        
        // Send email with error handling
        let emailResult;
        try {
            emailResult = await emailService.sendEmail({
                to: assignedUser.email,
                subject: `⚠️ Action requise - Indicateur: ${indicator.Designation || indicateur}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;border:1px solid #e5e7eb;border-radius:10px;">
                        <h2 style="color:#dc2626;">⚠️ Action requise pour votre indicateur</h2>
                        <p>Bonjour <strong>${assignedUser.username}</strong>,</p>
                        <p>Le responsable <strong>${username}</strong> vous notifie que des actions sont requises pour l'indicateur suivant :</p>
                    
                    <table style="border-collapse:collapse;width:100%;margin-top:12px;background-color:#f9fafb;">
                        <tr><td style="padding:8px;font-weight:bold;border:1px solid #e5e7eb;">Indicateur</td><td style="padding:8px;border:1px solid #e5e7eb;">${indicator.Designation || indicateur}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;border:1px solid #e5e7eb;">Processus</td><td style="padding:8px;border:1px solid #e5e7eb;">${processus || 'N/A'}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;border:1px solid #e5e7eb;">Date limite</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${deadlineText}</td></tr>
                    </table>
                    
                    <h3 style="margin-top:20px;color:#374151;">Mois en attente (${currentYear})</h3>
                    <table style="border-collapse:collapse;width:100%;margin-top:8px;">
                        <tr style="background-color:#e5e7eb;"><th style="padding:6px;text-align:left;">Mois</th><th style="padding:6px;text-align:left;">Objectif</th><th style="padding:6px;text-align:left;">Réalisation</th></tr>
                        ${pendingListHtml}
                    </table>
                    
                    <p style="margin-top:20px;color:#6b7280;font-size:13px;">
                        Veuillez vous connecter à <strong>AAF KPI</strong> pour créer un plan d'action et suivre les réalisations.
                    </p>
                    
                    <hr style="border-color:#e5e7eb;margin-top:30px;">
                    <p style="color:#9ca3af;font-size:12px;">AAF KPI Intranet - Notification automatique</p>
                </div>
            `
        });
        console.log(`✅ Email sent successfully: ${emailResult?.messageId}`);
        } catch (emailError) {
            console.error('Email sending error:', emailError.message);
            return res.status(500).json({ error: 'Échec de l\'envoi de l\'email de notification: ' + emailError.message });
        }
        
        console.log(`✅ Notification email sent to ${assignedUser.email} for indicator ${indicator.Designation || indicateur}`);
        
        res.json({ 
            success: true, 
            message: `Email sent to ${assignedUser.username} (${assignedUser.email})`,
            recipient: assignedUser.username
        });
        
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Failed to send notification', details: error.message });
    }
});

// GET /api/indicateurs/:id - Get indicator by Nordre (with permission check)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Admin users can access any indicateur
        if (req.user.isAdmin) {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('Nordre', sql.Int, id)
                .query('SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre');
            
            if (result.recordset.length === 0) {
                return res.status(404).json({ error: 'Indicator not found' });
            }
            return res.json(result.recordset[0]);
        }

        // Regular users need permission for this indicateur
        const userPermissions = await UserPermission.getByUserId(req.user.id);
        const hasPermission = userPermissions.some(p => 
            p.indicateur === id
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Nordre', sql.Int, id)
            .query('SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Indicator not found' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error fetching indicateur:', error);
        res.status(500).json({ error: 'Failed to fetch indicateur', details: error.message });
    }
});

// POST /api/indicateurs - Create new indicator
router.post('/', authMiddleware, async (req, res) => {
    try {
        // Only admins can create indicators
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { Indicateur, Processus, Designation, Signe, Unite } = req.body;
        
        // Get the next Nordre value
        const pool = await poolPromise;
        const maxResult = await pool.request().query('SELECT MAX(Nordre) as maxNordre FROM dbo.Indicateur');
        const nextNordre = (maxResult.recordset[0].maxNordre || 0) + 1;

        const result = await pool.request()
            .input('Nordre', sql.Int, nextNordre)
            .input('Indicateur', sql.VarChar, Indicateur || '')
            .input('Processus', sql.VarChar, Processus || '')
            .input('Designation', sql.VarChar, Designation || '')
            .input('Signe', sql.VarChar, Signe || '')
            .input('Unite', sql.VarChar, Unite || '')
            .query(`INSERT INTO dbo.Indicateur (Nordre, Indicateur, Processus, Designation, Signe, Unite) 
                    VALUES (@Nordre, @Indicateur, @Processus, @Designation, @Signe, @Unite);
                    SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre`);
        
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating indicateur:', error);
        res.status(500).json({ error: 'Failed to create indicateur', details: error.message });
    }
});

// PUT /api/indicateurs/:id - Update indicator
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        // Only admins can update indicators
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { id } = req.params;
        const { Indicateur, Processus, Designation, Signe, Unite } = req.body;
        
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Nordre', sql.Int, id)
            .input('Indicateur', sql.VarChar, Indicateur || '')
            .input('Processus', sql.VarChar, Processus || '')
            .input('Designation', sql.VarChar, Designation || '')
            .input('Signe', sql.VarChar, Signe || '')
            .input('Unite', sql.VarChar, Unite || '')
            .query(`UPDATE dbo.Indicateur 
                    SET Indicateur = @Indicateur, Processus = @Processus, Designation = @Designation, 
                        Signe = @Signe, Unite = @Unite 
                    WHERE Nordre = @Nordre;
                    SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre`);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Indicator not found' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating indicateur:', error);
        res.status(500).json({ error: 'Failed to update indicateur', details: error.message });
    }
});
// DELETE /api/indicateurs/:id - Delete indicator
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const nordre = parseInt(req.params.id); // 👈 convert to number

        if (isNaN(nordre)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const pool = await poolPromise;

        const checkResult = await pool.request()
            .input('Nordre', sql.Int, nordre)
            .query('SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Indicator not found' });
        }

        await pool.request()
            .input('Nordre', sql.Int, nordre)
            .query('DELETE FROM dbo.Indicateur WHERE Nordre = @Nordre');

        res.json({ message: 'Indicator deleted successfully' });

    } catch (error) {
        console.error('Error deleting indicateur:', error);
        res.status(500).json({ error: 'Failed to delete indicateur', details: error.message });
    }
});
module.exports = router;
