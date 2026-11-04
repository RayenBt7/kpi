const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');

const NOTIFICATION_TYPES = {
    RAPPEL: 'rappel',
    NON_SAISIE: 'non_saisie',
    OBJECTIF_NON_ATTEINT: 'objectif_non_atteint',
    DELAI_DEPASSE: 'delai_depasse',
    AVERTISSEMENT: 'avertissement'
};

const DEFAULT_SETTINGS = {
    jours_rappel: 5,
    jours_action: 3,
    jours_escalade: 3,
    activer_rappel: true,
    activer_non_saisie: true,
    objectif_non_atteint: true,
    delai_depasse: true
};

const buildNotificationScopeClause = () => `
    (
        destinataire_id = @user_id
        OR (
            @is_admin = 1
            AND (
                destinataire_type = 'admin'
                OR (destinataire_type IS NULL AND destinataire_id IS NULL)
            )
        )
    )
`;

const mapNotificationRecord = (row) => ({
    id: row.id,
    indicateur: row.indicateur,
    processus: row.processus,
    type: row.type,
    destinataire_type: row.destinataire_type,
    destinataire_id: row.destinataire_id,
    message: row.message,
    priorite: row.priorite || 'normale',
    statut: row.statut || 'non_lue',
    date_creation: row.date_creation || row.created_at,
    date_lecture: row.date_lecture || null
});

const createScopedRequest = async (req) => {
    const pool = await poolPromise;
    return pool.request()
        .input('user_id', sql.Int, req.user.id)
        .input('is_admin', sql.Bit, req.user.isAdmin ? 1 : 0);
};

router.get('/', authMiddleware, async (req, res) => {
    try {
        const request = await createScopedRequest(req);
        const result = await request.query(`
            SELECT
                id,
                indicateur,
                processus,
                type,
                destinataire_type,
                destinataire_id,
                message,
                priorite,
                statut,
                date_lecture,
                COALESCE(date_creation, created_at) AS date_creation,
                created_at
            FROM dbo.notifications
            WHERE ${buildNotificationScopeClause()}
            ORDER BY COALESCE(date_creation, created_at) DESC, id DESC
        `);

        const notifications = result.recordset.map(mapNotificationRecord);
        const unreadCount = notifications.filter((notification) => notification.statut === 'non_lue').length;

        res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
    }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const request = await createScopedRequest(req);
        const result = await request.query(`
            SELECT COUNT(*) AS unreadCount
            FROM dbo.notifications
            WHERE ${buildNotificationScopeClause()}
              AND COALESCE(statut, 'non_lue') = 'non_lue'
        `);

        res.json({ unreadCount: result.recordset[0]?.unreadCount || 0 });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count', details: error.message });
    }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id, 10);
        if (!Number.isInteger(notificationId)) {
            return res.status(400).json({ error: 'Invalid notification id' });
        }

        const request = await createScopedRequest(req);
        const result = await request
            .input('notification_id', sql.Int, notificationId)
            .query(`
                UPDATE dbo.notifications
                SET statut = 'lue',
                    date_lecture = COALESCE(date_lecture, GETDATE()),
                    updated_at = GETDATE()
                WHERE id = @notification_id
                  AND ${buildNotificationScopeClause()};

                SELECT @@ROWCOUNT AS updatedCount;
            `);

        if (!result.recordset[0]?.updatedCount) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read', details: error.message });
    }
});

router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        const request = await createScopedRequest(req);
        const result = await request.query(`
            UPDATE dbo.notifications
            SET statut = 'lue',
                date_lecture = COALESCE(date_lecture, GETDATE()),
                updated_at = GETDATE()
            WHERE ${buildNotificationScopeClause()}
              AND COALESCE(statut, 'non_lue') = 'non_lue';

            SELECT @@ROWCOUNT AS updatedCount;
        `);

        res.json({
            success: true,
            updatedCount: result.recordset[0]?.updatedCount || 0,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read', details: error.message });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id, 10);
        if (!Number.isInteger(notificationId)) {
            return res.status(400).json({ error: 'Invalid notification id' });
        }

        const request = await createScopedRequest(req);
        const result = await request
            .input('notification_id', sql.Int, notificationId)
            .query(`
                DELETE FROM dbo.notifications
                WHERE id = @notification_id
                  AND ${buildNotificationScopeClause()};

                SELECT @@ROWCOUNT AS deletedCount;
            `);

        if (!result.recordset[0]?.deletedCount) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification', details: error.message });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            indicateur,
            processus,
            type,
            destinataire_type,
            destinataire_id,
            message,
            priorite
        } = req.body;

        if (!type || !message) {
            return res.status(400).json({ error: 'Type and message are required' });
        }

        const notificationTargetType = destinataire_type || 'user';
        const notificationTargetId = destinataire_id ?? null;

        if (notificationTargetType !== 'admin' && notificationTargetId === null) {
            return res.status(400).json({ error: 'destinataire_id is required for non-admin notifications' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('indicateur', sql.NVarChar(500), indicateur || null)
            .input('processus', sql.NVarChar(255), processus || null)
            .input('type', sql.NVarChar(50), type)
            .input('destinataire_type', sql.NVarChar(50), notificationTargetType)
            .input('destinataire_id', sql.Int, notificationTargetId)
            .input('message', sql.NVarChar(sql.MAX), message)
            .input('priorite', sql.NVarChar(20), priorite || 'normale')
            .query(`
                INSERT INTO dbo.notifications (
                    indicateur,
                    processus,
                    type,
                    destinataire_type,
                    destinataire_id,
                    message,
                    priorite,
                    date_creation,
                    statut,
                    created_at,
                    updated_at
                )
                VALUES (
                    @indicateur,
                    @processus,
                    @type,
                    @destinataire_type,
                    @destinataire_id,
                    @message,
                    @priorite,
                    GETDATE(),
                    'non_lue',
                    GETDATE(),
                    GETDATE()
                );
                SELECT SCOPE_IDENTITY() AS id;
            `);

        res.status(201).json({
            success: true,
            id: result.recordset[0]?.id,
            message: 'Notification created successfully'
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification', details: error.message });
    }
});

router.get('/settings', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT TOP 1 * FROM dbo.notification_settings ORDER BY id DESC
        `);

        res.json(result.recordset[0] || DEFAULT_SETTINGS);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
    }
});

router.put('/settings', authMiddleware, async (req, res) => {
    try {
        const {
            jours_rappel,
            jours_action,
            jours_escalade,
            activer_rappel,
            activer_non_saisie,
            objectif_non_atteint,
            delai_depasse
        } = req.body;

        const pool = await poolPromise;
        const settingsResult = await pool.request().query(`
            SELECT TOP 1 id FROM dbo.notification_settings ORDER BY id DESC
        `);

        const request = pool.request()
            .input('jours_rappel', sql.Int, jours_rappel || DEFAULT_SETTINGS.jours_rappel)
            .input('jours_action', sql.Int, jours_action || DEFAULT_SETTINGS.jours_action)
            .input('jours_escalade', sql.Int, jours_escalade || DEFAULT_SETTINGS.jours_escalade)
            .input('activer_rappel', sql.Bit, activer_rappel !== undefined ? (activer_rappel ? 1 : 0) : 1)
            .input('activer_non_saisie', sql.Bit, activer_non_saisie !== undefined ? (activer_non_saisie ? 1 : 0) : 1)
            .input('objectif_non_atteint', sql.Bit, objectif_non_atteint !== undefined ? (objectif_non_atteint ? 1 : 0) : 1)
            .input('delai_depasse', sql.Bit, delai_depasse !== undefined ? (delai_depasse ? 1 : 0) : 1);

        if (settingsResult.recordset[0]?.id) {
            await request
                .input('settings_id', sql.Int, settingsResult.recordset[0].id)
                .query(`
                    UPDATE dbo.notification_settings
                    SET jours_rappel = @jours_rappel,
                        jours_action = @jours_action,
                        jours_escalade = @jours_escalade,
                        activer_rappel = @activer_rappel,
                        activer_non_saisie = @activer_non_saisie,
                        objectif_non_atteint = @objectif_non_atteint,
                        delai_depasse = @delai_depasse,
                        updated_at = GETDATE()
                    WHERE id = @settings_id
                `);
        } else {
            await request.query(`
                INSERT INTO dbo.notification_settings (
                    jours_rappel,
                    jours_action,
                    jours_escalade,
                    activer_rappel,
                    activer_non_saisie,
                    objectif_non_atteint,
                    delai_depasse,
                    created_at,
                    updated_at
                )
                VALUES (
                    @jours_rappel,
                    @jours_action,
                    @jours_escalade,
                    @activer_rappel,
                    @activer_non_saisie,
                    @objectif_non_atteint,
                    @delai_depasse,
                    GETDATE(),
                    GETDATE()
                )
            `);
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings', details: error.message });
    }
});

module.exports = router;
