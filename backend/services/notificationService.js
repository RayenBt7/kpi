const { poolPromise, sql } = require('../config/database');
const emailService = require('./emailService');

const NOTIFICATION_TYPES = {
    RAPPEL: 'rappel',
    NON_SAISIE: 'non_saisie',
    OBJECTIF_NON_ATTEINT: 'objectif_non_atteint',
    DELAI_DEPASSE: 'delai_depasse',
    AVERTISSEMENT: 'avertissement'
};

const DESTINATAIRE_TYPES = {
    USER: 'user',
    RESPONSABLE: 'responsable',
    PILOTE: 'pilote',
    ADMIN: 'admin'
};

const MONTH_COLUMNS = {
    1: 'janv',
    2: 'fev',
    3: 'mars',
    4: 'avril',
    5: 'mai',
    6: 'juin',
    7: 'juil',
    8: 'aout',
    9: 'sept',
    10: 'oct',
    11: 'nov',
    12: 'decem'
};

const toNumber = (value) => {
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

    if (!sign) return '>';
    if (['>=', '=>'].includes(sign)) return '>=';
    if (['<=', '=<'].includes(sign)) return '<=';
    if (['!=', '<>'].includes(sign)) return '!=';
    if (['>', '<', '='].includes(sign)) return sign;
    return sign;
};

const isObjectiveMissed = (realise, objectif, signRaw) => {
    if (realise === null || objectif === null) {
        return false;
    }

    const sign = normalizeSign(signRaw);

    if (sign === '<' || sign === '<=') {
        return realise > objectif;
    }

    if (sign === '=') {
        return Math.abs(realise - objectif) > 0.0001;
    }

    if (sign === '!=' || sign === '<>') {
        return Math.abs(realise - objectif) <= 0.0001;
    }

    return realise < objectif;
};

class NotificationService {
    constructor() {
        this.settings = null;
    }

    async loadSettings() {
        try {
            const pool = await poolPromise;
            const result = await pool.request().query(`
                SELECT TOP 1 * FROM dbo.notification_settings ORDER BY id DESC
            `);

            this.settings = result.recordset[0] || {
                jours_rappel: 3,
                jours_action: 3,
                jours_escalade: 3,
                activer_rappel: true,
                activer_non_saisie: true,
                objectif_non_atteint: true,
                delai_depasse: true
            };

            console.log('Notification settings loaded:', this.settings);
        } catch (error) {
            console.error('Error loading notification settings:', error);
            this.settings = {
                jours_rappel: 3,
                jours_action: 3,
                jours_escalade: 3,
                activer_rappel: true,
                activer_non_saisie: true,
                objectif_non_atteint: true,
                delai_depasse: true
            };
        }
    }

    async createNotification(indicateur, processus, type, destinataireType, destinataireId, message, priorite = 'normale') {
        try {
            const pool = await poolPromise;

            const existingCheck = await pool.request()
                .input('indicateur', sql.NVarChar(500), indicateur)
                .input('type', sql.NVarChar(50), type)
                .input('destinataire_type', sql.NVarChar(50), destinataireType)
                .input('destinataire_id', sql.Int, destinataireId)
                .query(`
                    SELECT TOP 1 id
                    FROM dbo.notifications
                    WHERE indicateur = @indicateur
                      AND type = @type
                      AND destinataire_type = @destinataire_type
                      AND destinataire_id = @destinataire_id
                      AND COALESCE(date_creation, created_at) > DATEADD(HOUR, -24, GETDATE())
                    ORDER BY COALESCE(date_creation, created_at) DESC
                `);

            if (existingCheck.recordset.length > 0) {
                console.log(`Notification already exists for ${indicateur} - ${type}`);
                return null;
            }

            const result = await pool.request()
                .input('indicateur', sql.NVarChar(500), indicateur || null)
                .input('processus', sql.NVarChar(255), processus || null)
                .input('type', sql.NVarChar(50), type)
                .input('destinataire_type', sql.NVarChar(50), destinataireType)
                .input('destinataire_id', sql.Int, destinataireId)
                .input('message', sql.NVarChar(sql.MAX), message)
                .input('priorite', sql.NVarChar(20), priorite)
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

            console.log(`Created notification: ${type} for ${indicateur} -> ${destinataireType}:${destinataireId}`);
            return result.recordset[0]?.id || null;
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }

    async sendNotificationEmail(toEmail, subject, htmlContent) {
        try {
            if (!emailService.isConfigured()) {
                console.log('Email service not configured, skipping email send');
                return false;
            }

            await emailService.sendEmail({
                to: toEmail,
                subject,
                html: htmlContent
            });

            console.log(`Email sent to ${toEmail} via ${emailService.getEmailProvider()}`);
            return true;
        } catch (error) {
            console.error(`Failed to send email to ${toEmail}:`, error.message);
            return false;
        }
    }

    async checkNonSaisie() {
        if (!this.settings.activer_non_saisie) {
            console.log('Non-saisie check disabled');
            return;
        }

        console.log('Checking non-saisie -> notify responsable...');

        try {
            const pool = await poolPromise;
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const monthCol = MONTH_COLUMNS[currentMonth];

            const indicatorsResult = await pool.request()
                .input('currentYear', sql.Int, currentYear)
                .query(`
                    SELECT DISTINCT
                        LTRIM(RTRIM(ia.indicateur)) AS indicateur,
                        i.Designation as Designation,
                        resp.id AS responsable_id,
                        resp.username AS responsable_username,
                        resp.email AS responsable_email,
                        COALESCE(NULLIF(LTRIM(RTRIM(i.Processus)), ''), 'Sans processus') AS processus
                    FROM dbo.indicator_assignments ia
                    INNER JOIN dbo.Indicateur i ON i.Indicateur = ia.indicateur
                    INNER JOIN dbo.users resp ON LTRIM(RTRIM(resp.username)) = LTRIM(RTRIM(ia.responsable_name))
                    LEFT JOIN dbo.realise r ON r.indicateur = ia.indicateur
                        AND YEAR(COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow))) = @currentYear
                    WHERE (r.${monthCol} IS NULL OR LTRIM(RTRIM(CAST(r.${monthCol} AS NVARCHAR(255)))) = '')
                      AND NULLIF(LTRIM(RTRIM(ia.responsable_name)), '') IS NOT NULL
                `);

            let notificationCount = 0;

            for (const row of indicatorsResult.recordset) {
                if (!row.indicateur || !row.responsable_id) {
                    continue;
                }

                const designation = row.Designation?.trim() || row.indicateur;
                const message = `Valeur non saisie: "${designation}" (${row.processus}) - ${currentMonth}/${currentYear}. Action requise pour votre utilisateur assigne.`;

                const notifId = await this.createNotification(
                    row.indicateur,
                    row.processus,
                    NOTIFICATION_TYPES.NON_SAISIE,
                    DESTINATAIRE_TYPES.RESPONSABLE,
                    row.responsable_id,
                    message,
                    'haute'
                );

                if (notifId) {
                    notificationCount += 1;
                    console.log(`Notified responsable ${row.responsable_username} for ${row.indicateur}`);
                }
            }

            console.log(`Created ${notificationCount} responsable non-saisie notifications`);
        } catch (error) {
            console.error('Error checkNonSaisie:', error);
        }
    }

    async checkObjectifNonAtteint() {
        if (!this.settings.objectif_non_atteint) {
            console.log('Objectif non atteint check disabled');
            return;
        }

        console.log('Checking objectif non atteint -> notify responsable...');

        try {
            const pool = await poolPromise;
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const monthCol = MONTH_COLUMNS[currentMonth];

            const indicatorsResult = await pool.request()
                .input('currentYear', sql.Int, currentYear)
                .query(`
                    SELECT DISTINCT
                        LTRIM(RTRIM(ia.indicateur)) AS indicateur,
                        resp.id AS responsable_id,
                        resp.username AS responsable_username,
                        resp.email AS responsable_email,
                        COALESCE(NULLIF(LTRIM(RTRIM(i.Processus)), ''), 'Sans processus') AS processus,
                        i.Signe,
                        i.Designation as Designation,
                        TRY_CONVERT(FLOAT, o.${monthCol}) AS objectif_val,
                        TRY_CONVERT(FLOAT, r.${monthCol}) AS realise_val
                    FROM dbo.indicator_assignments ia
                    INNER JOIN dbo.Indicateur i ON i.Indicateur = ia.indicateur
                    INNER JOIN dbo.users resp ON LTRIM(RTRIM(resp.username)) = LTRIM(RTRIM(ia.responsable_name))
                    LEFT JOIN dbo.objectiv o ON o.indicateur = ia.indicateur
                        AND YEAR(COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow))) = @currentYear
                    LEFT JOIN dbo.realise r ON r.indicateur = ia.indicateur
                        AND YEAR(COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow))) = @currentYear
                    WHERE o.${monthCol} IS NOT NULL
                      AND r.${monthCol} IS NOT NULL
                `);

            let notificationCount = 0;

            for (const row of indicatorsResult.recordset) {
                const indicatorName = row.Designation?.trim();
                const responsableId = row.responsable_id;
                const objectifVal = toNumber(row.objectif_val);
                const realiseVal = toNumber(row.realise_val);

                if (!indicatorName || !responsableId || objectifVal === null || realiseVal === null) {
                    continue;
                }

                if (!isObjectiveMissed(realiseVal, objectifVal, row.Signe)) {
                    continue;
                }

                const message = `Objectif non atteint: "${indicatorName}" (${row.processus}) - Objectif: ${objectifVal}, Realise: ${realiseVal}`;

                const notifId = await this.createNotification(
                    indicatorName,
                    row.processus,
                    NOTIFICATION_TYPES.OBJECTIF_NON_ATTEINT,
                    DESTINATAIRE_TYPES.RESPONSABLE,
                    responsableId,
                    message,
                    'haute'
                );

                if (!notifId) {
                    continue;
                }

                notificationCount += 1;
                console.log(`Notified responsable ${row.responsable_username} for objectif non atteint: ${indicatorName}`);

                if (row.responsable_email) {
                    const emailSubject = `Objectif non atteint - ${indicatorName}`;
                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #dc2626;">Objectif non atteint</h2>
                            <p>Bonjour <strong>${row.responsable_username}</strong>,</p>
                            <p>L'indicateur <strong>"${indicatorName}"</strong> n'a pas atteint son objectif pour le mois en cours.</p>
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Processus:</strong> ${row.processus}</p>
                                <p><strong>Objectif:</strong> ${objectifVal}</p>
                                <p><strong>Realise:</strong> ${realiseVal}</p>
                            </div>
                            <p>Veuillez creer un plan d'action pour corriger cette situation.</p>
                            <p style="color: #6b7280; font-size: 12px;">Cet email a ete envoye automatiquement par le systeme AAF KPI.</p>
                        </div>
                    `;
                    await this.sendNotificationEmail(row.responsable_email, emailSubject, emailHtml);
                }
            }

            console.log(`Created ${notificationCount} responsable objectif notifications`);
        } catch (error) {
            console.error('Error checkObjectifNonAtteint:', error);
        }
    }

    async checkDelaiDepasse() {
        if (!this.settings.delai_depasse) {
            console.log('Delai depasse check disabled in settings');
            return;
        }

        console.log('Checking for delai depasse...');

        try {
            const pool = await poolPromise;
            const userIndsResult = await pool.request().query(`
                SELECT DISTINCT
                    u.id AS userId,
                    LTRIM(RTRIM(REPLACE(REPLACE(pa.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS indicateur,
                    i.Designation as Designation,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), ''),
                        'Sans processus'
                    ) AS processus,
                    pa.dateclotprevu
                FROM dbo.Plan_action pa
                INNER JOIN dbo.indicator_assignments ia ON
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ia.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(pa.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                INNER JOIN dbo.users u ON u.id = ia.user_id
                LEFT JOIN dbo.Indicateur i ON i.Indicateur = pa.Indicateur
                WHERE pa.dateclotprevu IS NOT NULL
                  AND pa.dateclotprevu <> ''
                  AND TRY_CONVERT(DATE, pa.dateclotprevu) < GETDATE()
                  AND (pa.efficacit IS NULL OR pa.efficacit = '' OR pa.efficacit NOT IN ('100%', '100', 'realise'))
            `);

            let notificationCount = 0;
            const processedPairs = new Set();

            for (const row of userIndsResult.recordset) {
                const key = `${row.userId}-${row.indicateur}`;
                if (processedPairs.has(key)) {
                    continue;
                }

                processedPairs.add(key);

                const designation = row.Designation?.trim() || row.indicateur;
                const message = `Delai depasse pour le plan d'action: "${designation}" - Date limite: ${row.dateclotprevu}`;

                const notifId = await this.createNotification(
                    row.indicateur,
                    row.processus,
                    NOTIFICATION_TYPES.DELAI_DEPASSE,
                    DESTINATAIRE_TYPES.USER,
                    row.userId,
                    message,
                    'critique'
                );

                if (notifId) {
                    notificationCount += 1;
                }
            }

            console.log(`Created ${notificationCount} delai depasse notifications`);
        } catch (error) {
            console.error('Error checking delai depasse:', error);
        }
    }

    async sendRappels() {
        if (!this.settings.activer_rappel) {
            console.log('Rappel check disabled in settings');
            return;
        }

        console.log('Sending rappels...');

        try {
            const pool = await poolPromise;
            const joursRappel = this.settings.jours_rappel || 3;

            const result = await pool.request()
                .input('joursRappel', sql.Int, joursRappel)
                .query(`
                    SELECT DISTINCT
                        u.id AS userId,
                        LTRIM(RTRIM(REPLACE(REPLACE(pa.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS indicateur,
                        i.Designation as Designation,
                        COALESCE(
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), ''),
                            'Sans processus'
                        ) AS processus,
                        pa.dateclotprevu
                    FROM dbo.Plan_action pa
                    INNER JOIN dbo.indicator_assignments ia ON
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ia.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(pa.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    INNER JOIN dbo.users u ON u.id = ia.user_id
                    LEFT JOIN dbo.Indicateur i ON i.Indicateur = pa.Indicateur
                    WHERE pa.dateclotprevu IS NOT NULL
                      AND pa.dateclotprevu <> ''
                      AND TRY_CONVERT(DATE, pa.dateclotprevu) > GETDATE()
                      AND TRY_CONVERT(DATE, pa.dateclotprevu) <= DATEADD(DAY, @joursRappel, GETDATE())
                      AND (pa.efficacit IS NULL OR pa.efficacit = '' OR pa.efficacit NOT IN ('100%', '100', 'realise'))
                `);

            let notificationCount = 0;
            const processedPairs = new Set();

            for (const row of result.recordset) {
                const key = `${row.userId}-${row.indicateur}`;
                if (processedPairs.has(key)) {
                    continue;
                }

                processedPairs.add(key);

                const designation = row.Designation?.trim() || row.indicateur;
                const message = `Rappel: Le plan d'action pour "${designation}" arrive a echeance le ${row.dateclotprevu}`;

                const notifId = await this.createNotification(
                    row.indicateur,
                    row.processus,
                    NOTIFICATION_TYPES.RAPPEL,
                    DESTINATAIRE_TYPES.USER,
                    row.userId,
                    message,
                    'normale'
                );

                if (notifId) {
                    notificationCount += 1;
                }
            }

            console.log(`Created ${notificationCount} rappel notifications`);
        } catch (error) {
            console.error('Error sending rappels:', error);
        }
    }

    async checkResponsableActionDelay() {
        console.log('Checking responsable delays -> pilote escalation...');

        try {
            const pool = await poolPromise;
            const delayDays = this.settings.jours_action || 3;

            const delayedNotifications = await pool.request()
                .input('delayDays', sql.Int, delayDays)
                .query(`
                    SELECT DISTINCT
                        n.indicateur,
                        i.Designation as Designation,
                        n.processus,
                        pilote.id AS pilote_id,
                        pilote.username AS pilote_username,
                        pilote.email AS pilote_email
                    FROM dbo.notifications n
                    INNER JOIN dbo.indicator_assignments ia ON
                        NULLIF(LTRIM(RTRIM(CAST(ia.indicateur AS NVARCHAR(500)))), '') =
                        NULLIF(LTRIM(RTRIM(CAST(n.indicateur AS NVARCHAR(500)))), '')
                    INNER JOIN dbo.users pilote ON LTRIM(RTRIM(pilote.username)) = LTRIM(RTRIM(ia.pilote_name))
                    LEFT JOIN dbo.Indicateur i ON i.Indicateur = n.indicateur
                    WHERE n.type = '${NOTIFICATION_TYPES.NON_SAISIE}'
                      AND n.destinataire_type = '${DESTINATAIRE_TYPES.RESPONSABLE}'
                      AND COALESCE(n.date_creation, n.created_at) < DATEADD(DAY, -@delayDays, GETDATE())
                      AND NULLIF(LTRIM(RTRIM(ia.pilote_name)), '') IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dbo.Plan_action pa
                          WHERE NULLIF(LTRIM(RTRIM(CAST(pa.Indicateur AS NVARCHAR(500)))), '') =
                                NULLIF(LTRIM(RTRIM(CAST(n.indicateur AS NVARCHAR(500)))), '')
                            AND pa.dateclot IS NULL
                      )
                `);

            let escalationCount = 0;

            for (const row of delayedNotifications.recordset) {
                if (!row.pilote_id) {
                    continue;
                }

                const designation = row.Designation?.trim() || row.indicateur;
                const message = `Escalade responsable: "${designation}" - Non traite depuis ${delayDays} jours. Plan d'action non cree.`;

                const notifId = await this.createNotification(
                    row.indicateur,
                    row.processus,
                    NOTIFICATION_TYPES.AVERTISSEMENT,
                    DESTINATAIRE_TYPES.PILOTE,
                    row.pilote_id,
                    message,
                    'critique'
                );

                if (!notifId) {
                    continue;
                }

                escalationCount += 1;
                console.log(`Escalated to pilote for responsable delay: ${row.indicateur}`);

                if (row.pilote_email) {
                    const designation = row.Designation?.trim() || row.indicateur;
                    const emailSubject = `Escalade - ${designation}`;
                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #dc2626;">Escalade - Le responsable n'a pas agi</h2>
                            <p>Bonjour <strong>${row.pilote_username}</strong>,</p>
                            <p>Le responsable de l'indicateur <strong>"${designation}"</strong> n'a pas cree de plan d'action depuis <strong>${delayDays} jours</strong>.</p>
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Indicateur:</strong> ${designation}</p>
                                <p><strong>Processus:</strong> ${row.processus}</p>
                                <p><strong>Delai:</strong> ${delayDays} jours sans action</p>
                            </div>
                            <p>Veuillez intervenir pour resoudre cette situation.</p>
                            <p style="color: #6b7280; font-size: 12px;">Cet email a ete envoye automatiquement par le systeme AAF KPI.</p>
                        </div>
                    `;
                    await this.sendNotificationEmail(row.pilote_email, emailSubject, emailHtml);
                }
            }

            console.log(`Created ${escalationCount} pilote escalations for responsable delays`);
        } catch (error) {
            console.error('Error checkResponsableActionDelay:', error);
        }
    }

    async runFullEscalationCycle() {
        console.log('=== PHASE 1: Full hierarchical escalation ===');
        const startTime = Date.now();

        try {
            await this.loadSettings();

            await Promise.all([
                this.checkNonSaisie(),
                this.checkObjectifNonAtteint(),
                this.checkResponsableActionDelay(),
                this.checkDelaiDepasse(),
                this.sendRappels()
            ]);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`PHASE 1 complete: ${duration}s`);
        } catch (error) {
            console.error('Phase 1 error:', error);
        }
    }

    async runAllChecks() {
        return this.runFullEscalationCycle();
    }
}

module.exports = new NotificationService();
