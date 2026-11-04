const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const UserPermission = require('../models/UserPermission');
const sql = require('mssql');
const { poolPromise } = require('../config/database');

const router = express.Router();

let assignmentsTableReadyPromise = null;
let descriptionsYearTableReadyPromise = null;
let responsableActionColumnReadyPromise = null;
let indicatorYearTableReadyPromise = null;

const ensureIndicatorAssignmentsTable = async () => {
    if (!assignmentsTableReadyPromise) {
        assignmentsTableReadyPromise = (async () => {
            const pool = await poolPromise;
            const tableResult = await pool.request().query(`
                SELECT 1 AS exists_flag
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = 'dbo'
                    AND TABLE_NAME = 'indicator_assignments'
            `);

            if (tableResult.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE dbo.indicator_assignments (
                        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        processus NVARCHAR(255) NOT NULL,
                        indicateur NVARCHAR(255) NOT NULL,
                        pilote_name NVARCHAR(255) NULL,
                        responsable_name NVARCHAR(255) NULL,
                        user_id INT NULL,
                        created_at DATETIME NULL,
                        updated_at DATETIME NULL,
                        updated_by INT NULL
                    )
                `);
            }

            const columnResult = await pool.request().query(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                    AND TABLE_NAME = 'indicator_assignments'
            `);
            const existingColumns = new Set(
                columnResult.recordset.map((row) => String(row.COLUMN_NAME || '').toLowerCase())
            );
            const requiredColumns = [
                ['pilote_name', 'NVARCHAR(255) NULL'],
                ['responsable_name', 'NVARCHAR(255) NULL'],
                ['user_id', 'INT NULL'],
                ['created_at', 'DATETIME NULL'],
                ['updated_at', 'DATETIME NULL'],
                ['updated_by', 'INT NULL'],
            ];

            for (const [columnName, definition] of requiredColumns) {
                if (!existingColumns.has(columnName.toLowerCase())) {
                    await pool.request().query(
                        `ALTER TABLE dbo.indicator_assignments ADD ${columnName} ${definition}`
                    );
                }
            }
        })().catch((error) => {
            assignmentsTableReadyPromise = null;
            throw error;
        });
    }

    return assignmentsTableReadyPromise;
};

const ensureIndicatorDescriptionsYearTable = async () => {
    if (!descriptionsYearTableReadyPromise) {
        descriptionsYearTableReadyPromise = (async () => {
            const pool = await poolPromise;
            await pool.request().query(`
                IF OBJECT_ID('dbo.indicator_descriptions_year', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.indicator_descriptions_year (
                        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        indicateur NVARCHAR(255) NOT NULL,
                        [year] INT NOT NULL,
                        description NVARCHAR(MAX) NULL,
                        created_at DATETIME NOT NULL CONSTRAINT DF_indicator_descriptions_year_created_at DEFAULT GETDATE(),
                        updated_at DATETIME NOT NULL CONSTRAINT DF_indicator_descriptions_year_updated_at DEFAULT GETDATE(),
                        updated_by INT NULL
                    );

                    CREATE UNIQUE INDEX UX_indicator_descriptions_year_indicateur_year
                        ON dbo.indicator_descriptions_year (indicateur, [year]);

                    CREATE INDEX IX_indicator_descriptions_year_indicateur
                        ON dbo.indicator_descriptions_year (indicateur);
                END

                IF COL_LENGTH('dbo.indicator_descriptions_year', 'updated_by') IS NULL
                BEGIN
                    ALTER TABLE dbo.indicator_descriptions_year
                        ADD updated_by INT NULL;
                END
            `);
        })().catch((error) => {
            descriptionsYearTableReadyPromise = null;
            throw error;
        });
    }

    return descriptionsYearTableReadyPromise;
};

const ensureResponsableActionColumn = async () => {
    if (!responsableActionColumnReadyPromise) {
        responsableActionColumnReadyPromise = (async () => {
            const pool = await poolPromise;
            await pool.request().query(`
                IF OBJECT_ID('dbo.responsable', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.responsable', 'responsable_action') IS NULL
                BEGIN
                    ALTER TABLE dbo.responsable
                        ADD responsable_action NVARCHAR(255) NULL;
                END
            `);
        })().catch((error) => {
            responsableActionColumnReadyPromise = null;
            throw error;
        });
    }

    return responsableActionColumnReadyPromise;
};

const ensureIndicatorYearTable = async () => {
    if (!indicatorYearTableReadyPromise) {
        indicatorYearTableReadyPromise = (async () => {
            const pool = await poolPromise;
            const tableResult = await pool.request().query(`
                SELECT 1 AS exists_flag
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = 'dbo'
                    AND TABLE_NAME = 'Indicateur_Annee'
            `);

            if (tableResult.recordset.length === 0) {
                await pool.request().query(`
                    CREATE TABLE dbo.Indicateur_Annee (
                        IdIndicateur INT NULL,
                        IdProcessus INT NULL,
                        Annee INT NULL,
                        Signe NVARCHAR(50) NULL,
                        Unite NVARCHAR(100) NULL,
                        indicateur NVARCHAR(255) NULL,
                        processus NVARCHAR(255) NULL
                    )
                `);
            }

            const columnResult = await pool.request().query(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                    AND TABLE_NAME = 'Indicateur_Annee'
            `);
            const existingColumns = new Set(
                columnResult.recordset.map((row) => String(row.COLUMN_NAME || '').toLowerCase())
            );
            const requiredColumns = [
                ['IdIndicateur', 'INT NULL'],
                ['IdProcessus', 'INT NULL'],
                ['Annee', 'INT NULL'],
                ['Signe', 'NVARCHAR(50) NULL'],
                ['Unite', 'NVARCHAR(100) NULL'],
                ['indicateur', 'NVARCHAR(255) NULL'],
                ['processus', 'NVARCHAR(255) NULL'],
            ];

            for (const [columnName, definition] of requiredColumns) {
                if (!existingColumns.has(columnName.toLowerCase())) {
                    await pool.request().query(
                        `ALTER TABLE dbo.Indicateur_Annee ADD ${columnName} ${definition}`
                    );
                }
            }
        })().catch((error) => {
            indicatorYearTableReadyPromise = null;
            throw error;
        });
    }

    return indicatorYearTableReadyPromise;
};

const hasUsersUserTypeColumn = async (db) => {
    const result = await db.request().query(`
        SELECT CASE
            WHEN COL_LENGTH('dbo.users', 'user_type') IS NULL THEN 0
            ELSE 1
        END AS hasUserTypeColumn
    `);

    return Number(result.recordset?.[0]?.hasUserTypeColumn) === 1;
};

const ensureUsersUserTypeColumn = async () => {
    const pool = await poolPromise;
    await pool.request().query(`
        IF COL_LENGTH('dbo.users', 'user_type') IS NULL
        BEGIN
            ALTER TABLE dbo.users
                ADD user_type NVARCHAR(50) NOT NULL
                CONSTRAINT DF_users_user_type DEFAULT 'user';
        END;

        UPDATE dbo.users
        SET user_type = 'user'
        WHERE user_type IS NULL OR LTRIM(RTRIM(user_type)) = '';
    `);
};

const sanitizeNullableText = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
};

const toNullableNumber = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsedFromString = Number.parseFloat(trimmed.replace(',', '.'));
        return Number.isFinite(parsedFromString) ? parsedFromString : null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeYear = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
};

const upsertIndicatorYear = async (db, {
    idIndicateur,
    idProcessus,
    indicateur,
    processus,
    annee,
    signe,
    unite,
}) => {
    const normalizedIndicateur = sanitizeNullableText(indicateur);
    const normalizedProcessus = sanitizeNullableText(processus);
    const normalizedYear = normalizeYear(annee);

    if (!normalizedIndicateur || !normalizedProcessus || !normalizedYear) {
        return null;
    }

    await ensureIndicatorYearTable();

    const fallbackIdIndicateur = Number.isInteger(Number(idIndicateur)) && Number(idIndicateur) > 0
        ? Number(idIndicateur)
        : null;
    const fallbackIdProcessus = Number.isInteger(Number(idProcessus)) && Number(idProcessus) > 0
        ? Number(idProcessus)
        : null;

    await db.request()
        .input('IdIndicateur', sql.Int, fallbackIdIndicateur)
        .input('IdProcessus', sql.Int, fallbackIdProcessus)
        .input('Annee', sql.Int, normalizedYear)
        .input('Signe', sql.NVarChar(50), sanitizeNullableText(signe) || '')
        .input('Unite', sql.NVarChar(100), sanitizeNullableText(unite) || '')
        .input('indicateur', sql.NVarChar(255), normalizedIndicateur)
        .input('processus', sql.NVarChar(255), normalizedProcessus)
        .query(`
            UPDATE dbo.Indicateur_Annee
            SET
                IdIndicateur = COALESCE(NULLIF(@IdIndicateur, 0), IdIndicateur),
                IdProcessus = COALESCE(NULLIF(@IdProcessus, 0), IdProcessus),
                Signe = @Signe,
                Unite = @Unite,
                indicateur = @indicateur,
                processus = @processus
            WHERE
                indicateur = @indicateur
                AND processus = @processus
                AND Annee = @Annee;

            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO dbo.Indicateur_Annee (IdIndicateur, IdProcessus, Annee, Signe, Unite, indicateur, processus)
                VALUES (@IdIndicateur, @IdProcessus, @Annee, @Signe, @Unite, @indicateur, @processus);
            END
        `);

    const result = await db.request()
        .input('Annee', sql.Int, normalizedYear)
        .input('indicateur', sql.NVarChar(255), normalizedIndicateur)
        .input('processus', sql.NVarChar(255), normalizedProcessus)
        .query(`
            SELECT TOP 1 *
            FROM dbo.Indicateur_Annee
            WHERE
                indicateur = @indicateur
                AND processus = @processus
                AND Annee = @Annee
        `);

    return result.recordset?.[0] || null;
};

const roundToTwoDecimals = (value) => (
    Number.isFinite(value) ? Math.round(value * 100) / 100 : null
);

const VALID_MONTH_COLUMNS = ['janv', 'fev', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'decem'];

const normalizeComparisonSign = (value) => {
    const raw = String(value ?? '').trim();
    const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    const compact = normalized.replace(/\s+/g, '');

    if (
        raw.includes('>=') ||
        raw.includes('=>') ||
        raw.includes('\u2265') ||
        normalized.includes('superieur ou egal') ||
        normalized.includes('greater or equal')
    ) {
        return '\u2265';
    }

    if (
        raw.includes('<=') ||
        raw.includes('=<') ||
        raw.includes('\u2264') ||
        normalized.includes('inferieur ou egal') ||
        normalized.includes('less or equal')
    ) {
        return '\u2264';
    }

    if (
        raw.includes('!=') ||
        raw.includes('<>') ||
        raw.includes('\u2260') ||
        normalized.includes('different')
    ) {
        return '\u2260';
    }

    if (compact === 'inf') {
        return '\u2264';
    }

    if (compact === 'supp') {
        return '\u2265';
    }

    if (raw.includes('>') || normalized === 'gt' || normalized.includes('superieur')) {
        return '>';
    }

    if (raw.includes('<') || normalized === 'lt' || normalized.includes('inferieur')) {
        return '<';
    }

    if (raw.includes('=') || normalized === 'eq' || normalized.includes('egal')) {
        return '=';
    }

    return raw;
};

const reachesObjective = (realiseValue, objectiveValue, sign) => {
    const realise = toNullableNumber(realiseValue);
    const objective = toNullableNumber(objectiveValue);

    if (realise === null || objective === null) {
        return false;
    }

    const normalizedSign = normalizeComparisonSign(sign);

    if (normalizedSign === '\u2265') return realise >= objective;
    if (normalizedSign === '\u2264') return realise <= objective;
    if (normalizedSign === '>') return realise > objective;
    if (normalizedSign === '<') return realise < objective;
    if (normalizedSign === '=') return Math.abs(realise - objective) < 0.0001;
    if (normalizedSign === '\u2260') return Math.abs(realise - objective) >= 0.0001;

    return realise >= objective;
};

const computeProgressPercentage = (realiseValue, objectiveValue, sign) => {
    const realise = toNullableNumber(realiseValue);
    const objective = toNullableNumber(objectiveValue);

    if (realise === null || objective === null) {
        return null;
    }

    if (objective === 0) {
        return realise === 0 ? 100 : null;
    }

    const normalizedSign = normalizeComparisonSign(sign);

    if (normalizedSign === '\u2264' || normalizedSign === '<') {
        if (realise === 0) {
            return 100;
        }
        return roundToTwoDecimals((objective / realise) * 100);
    }

    return roundToTwoDecimals((realise / objective) * 100);
};

const parseOptionalUserId = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return Number.NaN;
    }

    return parsed;
};

const isAdminRequest = (req) => req.user && req.user.isAdmin === true;

const getMonthColumnFromValue = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > VALID_MONTH_COLUMNS.length) {
        return null;
    }

    return VALID_MONTH_COLUMNS[parsed - 1];
};

const fetchIndicatorIdentity = async (db, indicateurParam) => {
    const normalized = sanitizeNullableText(indicateurParam);
    if (!normalized) {
        return null;
    }

    const result = await db.request()
        .input('indicateur', sql.NVarChar(255), normalized)
        .query(`
            SELECT TOP 1
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS Indicateur,
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') AS Processus
            FROM dbo.Indicateur AS i
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
            ORDER BY
                CASE WHEN TRY_CONVERT(INT, i.Nordre) IS NULL THEN 1 ELSE 0 END,
                TRY_CONVERT(INT, i.Nordre),
                i.Indicateur
        `);

    return result.recordset[0] || null;
};

const fetchIndicatorsByProcessus = async (db, processusParam) => {
    const normalized = sanitizeNullableText(processusParam);
    if (!normalized) {
        return [];
    }

    const result = await db.request()
        .input('processus', sql.NVarChar(255), normalized)
        .query(`
            SELECT
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') AS Processus,
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS Indicateur
            FROM dbo.Indicateur AS i
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
            ORDER BY
                CASE WHEN TRY_CONVERT(INT, i.Nordre) IS NULL THEN 1 ELSE 0 END,
                TRY_CONVERT(INT, i.Nordre),
                i.Indicateur
        `);

    return result.recordset;
};

const fetchUserPermissionIndicatorsByProcessus = async (db, userId, processusParam) => {
    const normalizedProcessus = sanitizeNullableText(processusParam);
    if (!normalizedProcessus || !userId) {
        return [];
    }

    const result = await db.request()
        .input('userId', sql.Int, userId)
        .input('processus', sql.NVarChar(255), normalizedProcessus)
        .query(`
            WITH permitted AS (
                SELECT
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') AS Processus,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS Indicateur,
                    TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(i.Nordre)), '')) AS NordreSort,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), ''),
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        ORDER BY
                            CASE WHEN TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(i.Nordre)), '')) IS NULL THEN 1 ELSE 0 END,
                            TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(i.Nordre)), '')),
                            i.Nordre,
                            i.Indicateur
                    ) AS rn
                FROM dbo.user_permissions AS up
                INNER JOIN dbo.Indicateur AS i
                    ON
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                WHERE
                    up.user_id = @userId
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
            )
            SELECT Processus, Indicateur
            FROM permitted
            WHERE rn = 1
            ORDER BY
                CASE WHEN NordreSort IS NULL THEN 1 ELSE 0 END,
                NordreSort,
                Indicateur
        `);

    return result.recordset;
};

const upsertActionResponsableAssignment = async (db, { indicateur, actionResponsableName }) => {
    const normalizedIndicator = sanitizeNullableText(indicateur);
    const normalizedActionResponsable = sanitizeNullableText(actionResponsableName);

    if (!normalizedIndicator || !normalizedActionResponsable) {
        return {
            updatedCount: 0,
            responsableAction: null,
        };
    }

    await ensureResponsableActionColumn();

    const tableCheck = await db.request().query(`
        SELECT CASE
            WHEN OBJECT_ID('dbo.responsable', 'U') IS NULL THEN 0
            ELSE 1
        END AS hasResponsableTable
    `);

    if (Number(tableCheck.recordset?.[0]?.hasResponsableTable) !== 1) {
        const error = new Error('Table Responsable not found');
        error.statusCode = 500;
        throw error;
    }

    const existingResult = await db.request()
        .input('indicateur', sql.NVarChar(255), normalizedIndicator)
        .query(`
            SELECT COUNT(*) AS existingCount
            FROM dbo.responsable
            WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
        `);

    const existingCount = Number(existingResult.recordset?.[0]?.existingCount || 0);

    if (existingCount > 0) {
        const updateResult = await db.request()
            .input('indicateur', sql.NVarChar(255), normalizedIndicator)
            .input('responsableAction', sql.NVarChar(255), normalizedActionResponsable)
            .query(`
                UPDATE dbo.responsable
                SET responsable_action = @responsableAction
                WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur;

                SELECT @@ROWCOUNT AS updatedCount;
            `);

        return {
            updatedCount: Number(updateResult.recordset?.[0]?.updatedCount || 0),
            responsableAction: normalizedActionResponsable,
        };
    }

    const nextCodeResult = await db.request().query(`
        SELECT COALESCE(MAX(TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(code_responsable)), ''))), 0) + 1 AS nextCode
        FROM dbo.responsable
    `);

    const nextCode = Number(nextCodeResult.recordset?.[0]?.nextCode || 1);

    const insertResult = await db.request()
        .input('code', sql.NVarChar(50), String(nextCode))
        .input('indicateur', sql.NVarChar(255), normalizedIndicator)
        .input('responsable', sql.NVarChar(255), '')
        .input('pwd', sql.NVarChar(255), '')
        .input('responsableAction', sql.NVarChar(255), normalizedActionResponsable)
        .query(`
            INSERT INTO dbo.responsable (code_responsable, indicateur, responsable, Pwd, responsable_action)
            VALUES (@code, @indicateur, @responsable, @pwd, @responsableAction);

            SELECT 1 AS updatedCount;
        `);

    return {
        updatedCount: Number(insertResult.recordset?.[0]?.updatedCount || 0),
        responsableAction: normalizedActionResponsable,
    };
};

const ensureUserExists = async (db, userId) => {
    const result = await db.request()
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 id FROM dbo.users WHERE id = @userId');

    return result.recordset.length > 0;
};

const fetchAssignedUserId = async (db, processus, indicateur) => {
    const result = await db.request()
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .query(`
            SELECT TOP 1 user_id
            FROM dbo.indicator_assignments
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
            ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
        `);

    return result.recordset[0]?.user_id ?? null;
};

const ensureUserPermission = async (db, { userId, processus, indicateur }) => {
    if (!userId || !processus || !indicateur) {
        return;
    }

    await db.request()
        .input('userId', sql.Int, userId)
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .query(`
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.user_permissions
                WHERE
                    user_id = @userId
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
            )
            BEGIN
                INSERT INTO dbo.user_permissions (user_id, processus, indicateur)
                VALUES (@userId, @processus, @indicateur);
            END
        `);
};

const removeUserPermission = async (db, { userId, processus, indicateur }) => {
    if (!userId || !processus || !indicateur) {
        return;
    }

    await db.request()
        .input('userId', sql.Int, userId)
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .query(`
            DELETE FROM dbo.user_permissions
            WHERE
                user_id = @userId
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
        `);
};

const syncUserPermissionForAssignment = async (db, { previousUserId, nextUserId, processus, indicateur }) => {
    if (previousUserId && previousUserId !== nextUserId) {
        await removeUserPermission(db, { userId: previousUserId, processus, indicateur });
    }

    if (nextUserId) {
        await ensureUserPermission(db, { userId: nextUserId, processus, indicateur });
    }
};

const cleanupEmptyIndicatorAssignment = async (db, processus, indicateur) => {
    await db.request()
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .query(`
            DELETE FROM dbo.indicator_assignments
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(pilote_name, CHAR(13), ''), CHAR(10), ''))), '') IS NULL
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable_name, CHAR(13), ''), CHAR(10), ''))), '') IS NULL
                AND user_id IS NULL
        `);
};

const cleanupEmptyAssignmentsForProcessus = async (db, processus) => {
    await db.request()
        .input('processus', sql.NVarChar(255), processus)
        .query(`
            DELETE FROM dbo.indicator_assignments
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(pilote_name, CHAR(13), ''), CHAR(10), ''))), '') IS NULL
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable_name, CHAR(13), ''), CHAR(10), ''))), '') IS NULL
                AND user_id IS NULL
        `);
};

const upsertPiloteAssignment = async (db, { processus, indicateur, piloteName, updatedBy }) => {
    await db.request()
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .input('piloteName', sql.NVarChar(255), piloteName)
        .input('updatedBy', sql.Int, updatedBy ?? null)
        .query(`
            MERGE dbo.indicator_assignments AS target
            USING (SELECT @processus AS processus, @indicateur AS indicateur) AS source
            ON
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.processus, CHAR(13), ''), CHAR(10), ''))), '') = source.processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.indicateur, CHAR(13), ''), CHAR(10), ''))), '') = source.indicateur
            WHEN MATCHED THEN
                UPDATE SET
                    target.pilote_name = @piloteName,
                    target.updated_at = GETDATE(),
                    target.updated_by = @updatedBy
            WHEN NOT MATCHED THEN
                INSERT (processus, indicateur, pilote_name, responsable_name, user_id, updated_at, updated_by)
                VALUES (@processus, @indicateur, @piloteName, NULL, NULL, GETDATE(), @updatedBy);
        `);

    await cleanupEmptyIndicatorAssignment(db, processus, indicateur);
};

const upsertResponsableAssignment = async (db, { processus, indicateur, responsableName, updatedBy }) => {
    await db.request()
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .input('responsableName', sql.NVarChar(255), responsableName)
        .input('updatedBy', sql.Int, updatedBy ?? null)
        .query(`
            MERGE dbo.indicator_assignments AS target
            USING (SELECT @processus AS processus, @indicateur AS indicateur) AS source
            ON
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.processus, CHAR(13), ''), CHAR(10), ''))), '') = source.processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.indicateur, CHAR(13), ''), CHAR(10), ''))), '') = source.indicateur
            WHEN MATCHED THEN
                UPDATE SET
                    target.responsable_name = @responsableName,
                    target.updated_at = GETDATE(),
                    target.updated_by = @updatedBy
            WHEN NOT MATCHED THEN
                INSERT (processus, indicateur, responsable_name, user_id, updated_at, updated_by)
                VALUES (@processus, @indicateur, @responsableName, NULL, GETDATE(), @updatedBy);
        `);

    await cleanupEmptyIndicatorAssignment(db, processus, indicateur);
};

const upsertUserAssignment = async (db, { processus, indicateur, userId, updatedBy }) => {
    await db.request()
        .input('processus', sql.NVarChar(255), processus)
        .input('indicateur', sql.NVarChar(255), indicateur)
        .input('userId', sql.Int, userId)
        .input('updatedBy', sql.Int, updatedBy ?? null)
        .query(`
            MERGE dbo.indicator_assignments AS target
            USING (SELECT @processus AS processus, @indicateur AS indicateur) AS source
            ON
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.processus, CHAR(13), ''), CHAR(10), ''))), '') = source.processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.indicateur, CHAR(13), ''), CHAR(10), ''))), '') = source.indicateur
            WHEN MATCHED THEN
                UPDATE SET
                    target.user_id = @userId,
                    target.updated_at = GETDATE(),
                    target.updated_by = @updatedBy
            WHEN NOT MATCHED THEN
                INSERT (processus, indicateur, responsable_name, user_id, updated_at, updated_by)
                VALUES (@processus, @indicateur, NULL, @userId, GETDATE(), @updatedBy);
        `);

    await cleanupEmptyIndicatorAssignment(db, processus, indicateur);
};
// get /api/indicateur-annee 
router.get('/indicateur-annee', async (req, res) => {
    try {
        await ensureIndicatorYearTable();
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT
                LTRIM(RTRIM(IdIndicateur)) AS IdIndicateur,
                LTRIM(RTRIM(IdProcessus)) AS IdProcessus,
                LTRIM(RTRIM(Annee)) AS Annee,
                LTRIM(RTRIM(Signe)) AS Signe,
                LTRIM(RTRIM(Unite)) AS Unite
            FROM dbo.Indicateur_Annee
        `);

        return res.status(200).json({
            success: true,
            data: result.recordset,
        });
    } catch (error) {
        console.error('Error fetching indicateur_annee:', error);
        res.status(500).json({ error: 'Failed to fetch indicateur_annee', details: error.message });
    }
});
// POST /api/indicateur-annee (UPSERT) - Upsert year-specific Signe/Unite
router.post('/indicateur-annee', authMiddleware, async (req, res) => {
    try {
        // Only admins can update year-specific unit/sign
        if (!req.user?.isAdmin) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }

        const { indicateur, processus, Annee, Signe, Unite } = req.body || {};

        if (!Annee) {
            return res.status(400).json({ error: 'Annee is required' });
        }

        const annee = Number(Annee);
        if (!Number.isInteger(annee)) {
            return res.status(400).json({ error: 'Annee must be an integer' });
        }

        const normalizeText = (v) => {
            if (v === null || v === undefined) return '';
            return String(v).trim();
        };

        const signe = normalizeText(Signe);
        const unite = normalizeText(Unite);
        const normalizedIndicateur = sanitizeNullableText(indicateur);
        const normalizedProcessus = sanitizeNullableText(processus);

        if (!normalizedIndicateur || !normalizedProcessus) {
            return res.status(400).json({ error: 'indicateur and processus are required' });
        }

        const pool = await poolPromise;
        await ensureIndicatorYearTable();

        // First, get the IdIndicateur and IdProcessus from the Indicateur_Annee table or existing records
        const lookupResult = await pool.request()
            .input('indicateur', sql.NVarChar(255), normalizedIndicateur)
            .input('processus', sql.NVarChar(255), normalizedProcessus)
            .query(`
                SELECT TOP 1 
                    IdIndicateur, 
                    IdProcessus
                FROM dbo.Indicateur_Annee
                WHERE indicateur = @indicateur AND processus = @processus
                UNION ALL
                SELECT TOP 1
                    0 AS IdIndicateur,
                    0 AS IdProcessus
                FROM dbo.Indicateur AS i
                WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
            `);

        let idIndicateur = lookupResult.recordset[0]?.IdIndicateur;
        let idProcessus = lookupResult.recordset[0]?.IdProcessus;

        idIndicateur = idIndicateur || null;
        idProcessus = idProcessus || null;

        const row = await upsertIndicatorYear(pool, {
            idIndicateur,
            idProcessus,
            indicateur: normalizedIndicateur,
            processus: normalizedProcessus,
            annee,
            signe,
            unite,
        });

        return res.status(200).json({
            success: true,
            data: row,
        });
    } catch (error) {
        console.error('Error upserting indicateur_annee:', error);
        res.status(500).json({ error: 'Failed to upsert indicateur_annee', details: error.message });
    }
});
// GET /api/dashboard/monthly-conformity - Get monthly conformity summary grouped by processus
router.get('/monthly-conformity', authMiddleware, async (req, res) => {
    try {
        const parsedYear = Number.parseInt(req.query.year, 10);
        const currentYear = new Date().getFullYear();
        const selectedYear = Number.isInteger(parsedYear) ? parsedYear : currentYear;
        const fallbackMonth = new Date().getMonth() + 1;
        const requestedMonth = Number.parseInt(req.query.month, 10);
        const safeMonth = Number.isInteger(requestedMonth) ? requestedMonth : fallbackMonth;
        const monthKey = getMonthColumnFromValue(safeMonth);

        if (!monthKey) {
            return res.status(400).json({ error: 'Invalid month value' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('selectedYear', sql.Int, selectedYear)
            .query(`
                SELECT
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))) AS Processus,
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS Indicateur,
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Designation, CHAR(13), ''), CHAR(10), ''))) AS Designation,
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Signe, CHAR(13), ''), CHAR(10), ''))) AS Signe,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.${monthKey}) AS ObjectiveValue,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.${monthKey}) AS RealiseValue
                FROM dbo.Indicateur AS i
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
                ) AS o_current
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
                ) AS r_current
                WHERE i.Processus IS NOT NULL AND LTRIM(RTRIM(i.Processus)) <> ''
                ORDER BY
                    i.Processus,
                    CASE WHEN TRY_CONVERT(INT, i.Nordre) IS NULL THEN 1 ELSE 0 END,
                    TRY_CONVERT(INT, i.Nordre),
                    i.Indicateur
            `);

        const totals = {
            indicatorCount: 0,
            conformingCount: 0,
            nonConformingCount: 0,
            missingCount: 0,
        };

        const processMap = new Map();

        result.recordset.forEach((row) => {
            const processus = sanitizeNullableText(row.Processus) || 'Sans processus';
            const objectiveValue = toNullableNumber(row.ObjectiveValue);
            const realiseValue = toNullableNumber(row.RealiseValue);

            let status = 'missing';
            if (objectiveValue !== null && realiseValue !== null) {
                status = reachesObjective(realiseValue, objectiveValue, row.Signe)
                    ? 'conforming'
                    : 'nonConforming';
            }

            const current = processMap.get(processus) || {
                processus,
                indicatorCount: 0,
                conformingCount: 0,
                nonConformingCount: 0,
                missingCount: 0,
                indicators: [],
            };

            current.indicatorCount += 1;
            totals.indicatorCount += 1;

            if (status === 'conforming') {
                current.conformingCount += 1;
                totals.conformingCount += 1;
            } else if (status === 'nonConforming') {
                current.nonConformingCount += 1;
                totals.nonConformingCount += 1;
            } else {
                current.missingCount += 1;
                totals.missingCount += 1;
            }

            current.indicators.push({
                code: sanitizeNullableText(row.Indicateur) || '',
                designation: sanitizeNullableText(row.Designation) || sanitizeNullableText(row.Indicateur) || '',
                signe: sanitizeNullableText(row.Signe) || '',
                objective: objectiveValue,
                realise: realiseValue,
                status,
            });

            processMap.set(processus, current);
        });

        const processes = [...processMap.values()]
            .map((process) => ({
                ...process,
                conformityRate: process.indicatorCount > 0
                    ? roundToTwoDecimals((process.conformingCount / process.indicatorCount) * 100)
                    : null,
            }))
            .sort((left, right) => {
                if (right.nonConformingCount !== left.nonConformingCount) {
                    return right.nonConformingCount - left.nonConformingCount;
                }

                if (right.missingCount !== left.missingCount) {
                    return right.missingCount - left.missingCount;
                }

                return left.processus.localeCompare(right.processus, 'fr');
            });

        res.json({
            year: selectedYear,
            month: safeMonth,
            monthKey,
            totals: {
                ...totals,
                conformityRate: totals.indicatorCount > 0
                    ? roundToTwoDecimals((totals.conformingCount / totals.indicatorCount) * 100)
                    : null,
            },
            processes,
        });
    } catch (error) {
        console.error('Error fetching monthly conformity:', error);
        res.status(500).json({ error: 'Failed to fetch monthly conformity', details: error.message });
    }
});

// GET /api/dashboard/all-summary - Get ALL processus with ALL indicators in ONE request (for dashboard overview)
router.get('/all-summary', authMiddleware, async (req, res) => {
    try {
        const parsedYear = Number.parseInt(req.query.year, 10);
        const currentYear = new Date().getFullYear();
        const selectedYear = Number.isInteger(parsedYear) ? parsedYear : currentYear;
        const previousYear = selectedYear - 1;

        await ensureIndicatorAssignmentsTable();
        await ensureIndicatorDescriptionsYearTable();
        await ensureResponsableActionColumn();
        await ensureIndicatorYearTable();

        const pool = await poolPromise;
        const result = await pool.request()
            .input('selectedYear', sql.Int, selectedYear)
            .query(`
                SELECT
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))) AS Processus,
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS Indicateur,
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Designation, CHAR(13), ''), CHAR(10), ''))) AS Designation,
                    COALESCE(iy_selected.Signe, LTRIM(RTRIM(REPLACE(REPLACE(i.Signe, CHAR(13), ''), CHAR(10), '')))) AS Signe,
                    COALESCE(iy_selected.Unite, LTRIM(RTRIM(REPLACE(REPLACE(i.Unite, CHAR(13), ''), CHAR(10), '')))) AS Unite,
                    COALESCE(ia.Pilote, '') AS Pilote,
                    COALESCE(ia.Responsable, rs_legacy.Responsable) AS Responsable,
                    plan_action.PROGRESS AS Progress,
                    plan_action.ActionEnCours,
                    plan_action.DateCloturePrevue,
                    -- Objectives for selected year
                    oc.janv AS obj_janv, oc.fev AS obj_fev, oc.mars AS obj_mars, oc.avril AS obj_avril,
                    oc.mai AS obj_mai, oc.juin AS obj_juin, oc.juil AS obj_juil, oc.aout AS obj_aout,
                    oc.sept AS obj_sept, oc.oct AS obj_oct, oc.nov AS obj_nov, oc.decem AS obj_decem,
                    -- Realised values for selected year
                    rc.janv AS real_janv, rc.fev AS real_fev, rc.mars AS real_mars, rc.avril AS real_avril,
                    rc.mai AS real_mai, rc.juin AS real_juin, rc.juil AS real_juil, rc.aout AS real_aout,
                    rc.sept AS real_sept, rc.oct AS real_oct, rc.nov AS real_nov, rc.decem AS real_decem
                FROM dbo.Indicateur AS i
                OUTER APPLY (
                    SELECT TOP 1
                        1 AS HasSelectedYear,
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.Signe, CHAR(13), ''), CHAR(10), ''))), '') AS Signe,
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.Unite, CHAR(13), ''), CHAR(10), ''))), '') AS Unite
                    FROM dbo.Indicateur_Annee AS y
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                        AND TRY_CONVERT(INT, y.Annee) = @selectedYear
                ) AS iy_selected
                OUTER APPLY (
                    SELECT TOP 1 1 AS HasAnyYear
                    FROM dbo.Indicateur_Annee AS y
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                ) AS iy_any
                OUTER APPLY (
                    SELECT TOP 1
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.pilote_name, CHAR(13), ''), CHAR(10), ''))), '') AS Pilote,
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.responsable_name, CHAR(13), ''), CHAR(10), ''))), '') AS Responsable
                    FROM dbo.indicator_assignments AS ass
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                    ORDER BY
                        COALESCE(ass.updated_at, ass.created_at) DESC,
                        ass.id DESC
                ) AS ia
                OUTER APPLY (
                    SELECT TOP 1
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS Responsable
                    FROM dbo.responsable AS resp
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    ORDER BY
                        CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                        TRY_CONVERT(INT, resp.code_responsable),
                        resp.code_responsable
                ) AS rs_legacy
                OUTER APPLY (
                    SELECT TOP 1
                        TRY_CONVERT(DECIMAL(10, 2), pa.PROGRESS) AS PROGRESS,
                        pa.action AS ActionEnCours,
                        pa.dateclotprevu AS DateCloturePrevue
                    FROM dbo.Plan_action AS pa
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(pa.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        AND TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(pa.annee)), '')) = @selectedYear
                    ORDER BY
                        TRY_CONVERT(datetime, pa.datecreation) DESC,
                        TRY_CONVERT(datetime, pa.dateclot) DESC
                ) AS plan_action
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
                ) AS o_current
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
                ) AS r_current
                CROSS APPLY (
                    SELECT
                        TRY_CONVERT(DECIMAL(18, 4), o_current.janv) AS janv,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.fev) AS fev,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.mars) AS mars,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.avril) AS avril,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.mai) AS mai,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.juin) AS juin,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.juil) AS juil,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.aout) AS aout,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.sept) AS sept,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.oct) AS oct,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.nov) AS nov,
                        TRY_CONVERT(DECIMAL(18, 4), o_current.decem) AS decem
                ) AS oc
                CROSS APPLY (
                    SELECT
                        TRY_CONVERT(DECIMAL(18, 4), r_current.janv) AS janv,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.fev) AS fev,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.mars) AS mars,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.avril) AS avril,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.mai) AS mai,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.juin) AS juin,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.juil) AS juil,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.aout) AS aout,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.sept) AS sept,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.oct) AS oct,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.nov) AS nov,
                        TRY_CONVERT(DECIMAL(18, 4), r_current.decem) AS decem
                ) AS rc
                WHERE i.Processus IS NOT NULL
                    AND LTRIM(RTRIM(i.Processus)) <> ''
                    AND (iy_any.HasAnyYear IS NULL OR iy_selected.HasSelectedYear = 1)
                ORDER BY i.Processus, i.Nordre
            `);

        const months = ['janv', 'fev', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'decem'];

        const calculateValues = (row) => {
            let totalObjective = 0;
            let totalObjectiveComparable = 0;
            let totalRealise = 0;
            let monthsWithObjective = 0;
            let monthsWithRealise = 0;

            months.forEach((month) => {
                const objVal = toNullableNumber(row[`obj_${month}`]);
                if (objVal === null) {
                    return;
                }

                totalObjective += objVal;
                monthsWithObjective += 1;

                const realVal = toNullableNumber(row[`real_${month}`]);
                if (realVal === null) {
                    return;
                }

                totalObjectiveComparable += objVal;
                totalRealise += realVal;
                monthsWithRealise += 1;
            });

            if (monthsWithObjective === 0) {
                return {
                    totalObjective: null,
                    totalRealise: null,
                    avgObjective: null,
                    avgRealise: null,
                    kpiProgress: null,
                    objectiveReached: false,
                    monthsWithObjective: 0,
                    monthsWithRealise: 0,
                    comparableMonths: 0,
                    missingRealiseMonths: 0,
                    coverageRate: null
                };
            }

            const comparableMonths = monthsWithRealise;
            const avgObjective = comparableMonths > 0
                ? roundToTwoDecimals(totalObjectiveComparable / comparableMonths)
                : roundToTwoDecimals(totalObjective / monthsWithObjective);
            const avgRealise = comparableMonths > 0
                ? roundToTwoDecimals(totalRealise / comparableMonths)
                : null;
            const kpiProgress = comparableMonths > 0
                ? computeProgressPercentage(avgRealise, avgObjective, row.Signe)
                : null;
            const objectiveReached = comparableMonths > 0
                ? reachesObjective(avgRealise, avgObjective, row.Signe)
                : false;
            const coverageRate = roundToTwoDecimals((monthsWithRealise / monthsWithObjective) * 100);

            return {
                totalObjective: roundToTwoDecimals(totalObjective),
                totalRealise: comparableMonths > 0 ? roundToTwoDecimals(totalRealise) : null,
                avgObjective,
                avgRealise,
                kpiProgress,
                objectiveReached,
                monthsWithObjective,
                monthsWithRealise,
                comparableMonths,
                missingRealiseMonths: monthsWithObjective - monthsWithRealise,
                coverageRate
            };
        };

        const processusMap = {};
        result.recordset.forEach((row) => {
            const values = calculateValues(row);
            const actionPlanProgress = toNullableNumber(row.Progress);
            const hasActionPlan = actionPlanProgress !== null
                || sanitizeNullableText(row.ActionEnCours) !== null
                || row.DateCloturePrevue !== null;

            if (!processusMap[row.Processus]) {
                processusMap[row.Processus] = {
                    name: row.Processus,
                    indicators: []
                };
            }

            processusMap[row.Processus].indicators.push({
                code: row.Indicateur,
                designation: row.Designation,
                signe: row.Signe,
                unite: row.Unite,
                pilote: row.Pilote,
                responsable: row.Responsable,
                progress: values.kpiProgress,
                kpiProgress: values.kpiProgress,
                actionPlanProgress,
                objectiveReached: values.objectiveReached,
                objective: values.totalObjective,
                realise: values.totalRealise,
                avgObjective: values.avgObjective,
                avgRealise: values.avgRealise,
                coverageRate: values.coverageRate,
                monthsWithObjective: values.monthsWithObjective,
                monthsWithRealise: values.monthsWithRealise,
                comparableMonths: values.comparableMonths,
                missingRealiseMonths: values.missingRealiseMonths,
                hasActionPlan,
                actionEnCours: row.ActionEnCours,
                dateCloturePrevue: row.DateCloturePrevue
            });
        });

        res.json({
            year: selectedYear,
            previousYear: previousYear,
            processus: Object.values(processusMap)
        });
    } catch (error) {
        console.error('Error fetching all-summary:', error);
        res.status(500).json({ error: 'Failed to fetch all-summary', details: error.message });
    }
});

// GET /api/dashboard/processus - Get ALL unique Processus values (all authenticated users can view)
router.get('/processus', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT DISTINCT
                NULLIF(
                    LTRIM(RTRIM(REPLACE(REPLACE(Processus, CHAR(13), ''), CHAR(10), ''))),
                    ''
                ) AS Processus
            FROM dbo.Indicateur
            WHERE
                NULLIF(
                    LTRIM(RTRIM(REPLACE(REPLACE(Processus, CHAR(13), ''), CHAR(10), ''))),
                    ''
                ) IS NOT NULL
            ORDER BY Processus
        `);
        res.json({ processus: result.recordset.map((row) => row.Processus) });
    } catch (error) {
        console.error('Error fetching processus list:', error);
        res.status(500).json({ error: 'Failed to fetch processus list', details: error.message });
    }
});
// GET /api/dashboard/plan-years - Get ALL unique years from Plan_action (for historical data)
router.get('/plan-years', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT DISTINCT
                TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(annee)), '')) AS annee
            FROM dbo.Plan_action
            WHERE
                TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(annee)), '')) IS NOT NULL
            ORDER BY annee DESC
        `);
        res.json({ years: result.recordset.map((row) => row.annee) });
    } catch (error) {
        console.error('Error fetching plan years:', error);
        res.status(500).json({ error: 'Failed to fetch plan years', details: error.message });
    }
});

// GET /api/dashboard/my-editable-indicators - Returns the list of indicator codes the current user can edit
// Admin → can edit all (isAdmin: true, indicators: [])
// Responsable → can edit only their indicators
// Regular user → no editable indicators
router.get('/my-editable-indicators', authMiddleware, async (req, res) => {
    try {
        if (req.user.isAdmin) {
            return res.json({ isAdmin: true, indicators: [] });
        }

        await ensureIndicatorAssignmentsTable();

        const perms = await UserPermission.getByUserId(req.user.id);
        const permissionIndicators = perms.map((p) => sanitizeNullableText(p.indicateur)).filter(Boolean);

        const username = sanitizeNullableText(req.user.username);
        const parsedUserId = Number.parseInt(req.user.id, 10);
        const userId = Number.isInteger(parsedUserId) ? parsedUserId : null;
        let responsableIndicators = [];

        if (username || userId !== null) {
            const pool = await poolPromise;
            const normalizedUsername = username ? username.toLowerCase() : null;
            const request = pool.request()
                .input('username', sql.NVarChar(255), normalizedUsername)
                .input('userId', sql.Int, userId);

            const responsableResult = await request.query(`
                    WITH indicator_base AS (
                        SELECT
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') AS Processus,
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS Indicateur
                        FROM dbo.Indicateur AS i
                    ),
                    responsable_sources AS (
                        SELECT
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.processus, CHAR(13), ''), CHAR(10), ''))), '') AS Processus,
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS Indicateur
                        FROM dbo.indicator_assignments AS ass
                        WHERE (
                            LOWER(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.responsable_name, CHAR(13), ''), CHAR(10), ''))), '')) = @username
                            OR ass.user_id = @userId
                        )
                        UNION
                        SELECT
                            ib.Processus,
                            ib.Indicateur
                        FROM indicator_base AS ib
                        INNER JOIN dbo.responsable AS r
                            ON NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.indicateur, CHAR(13), ''), CHAR(10), ''))), '') = ib.Indicateur
                        WHERE LOWER(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.responsable, CHAR(13), ''), CHAR(10), ''))), '')) = @username
                    )
                    SELECT DISTINCT
                        rs.Indicateur
                    FROM responsable_sources AS rs
                    WHERE
                        rs.Processus IS NOT NULL
                        AND rs.Indicateur IS NOT NULL
                `);

            responsableIndicators = responsableResult.recordset
                .map((row) => sanitizeNullableText(row.Indicateur))
                .filter(Boolean);
        }

        const indicators = [...new Set([...permissionIndicators, ...responsableIndicators])];
        return res.json({ isAdmin: false, indicators });
    } catch (error) {
        console.error('Error fetching editable indicators:', error);
        res.status(500).json({ error: 'Failed to fetch editable indicators', details: error.message });
    }
});

// GET /api/dashboard/actions - Get all plan actions with indicator details
router.get('/actions', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                i.Processus,
                i.Designation AS Indicateur,
                p.annee,
                p.mois,
                p.action,
                p.PROGRESS,
                p.rootCause,
                p.responsable,
                p.dateclotprevu,
                p.datecreation,
                p.efficacit,
                p.dateclot
            FROM Plan_action p
            INNER JOIN Indicateur i 
            ON p.Indicateur = i.Indicateur
            ORDER BY i.Processus, p.annee DESC, p.mois
        `);
        res.json({ rows: result.recordset });
    } catch (error) {
        console.error('Error fetching all plan actions:', error);
        res.status(500).json({ error: 'Failed to fetch all plan actions', details: error.message });
    }
});

// GET /api/dashboard/plan-action/all - Get all plan actions with indicator details
router.get('/plan-action/all', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                i.Processus,
                i.Designation AS Indicateur,
                p.annee,
                p.mois,
                p.action,
                p.PROGRESS
            FROM Plan_action p
            INNER JOIN Indicateur i 
            ON p.Indicateur = i.Indicateur
            ORDER BY i.Processus, p.annee DESC, p.mois
        `);
        res.json({ rows: result.recordset });
    } catch (error) {
        console.error('Error fetching all plan actions:', error);
        res.status(500).json({ error: 'Failed to fetch all plan actions', details: error.message });
    }
});

// GET /api/dashboard/plan-action/pending - Get only monthly non-attained indicators for action plan creation
router.get('/plan-action/pending', authMiddleware, async (req, res) => {
    try {
        await ensureIndicatorAssignmentsTable();
        await ensureResponsableActionColumn();

        const parsedYear = Number.parseInt(req.query.year, 10);
        const currentYear = new Date().getFullYear();
        const selectedYear = Number.isInteger(parsedYear) ? parsedYear : currentYear;
        const parsedMonth = Number.parseInt(req.query.month, 10);
        const selectedMonth = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
            ? parsedMonth
            : null;

        const pool = await poolPromise;
        const [indicatorResult, actionResult] = await Promise.all([
            pool.request()
                .input('selectedYear', sql.Int, selectedYear)
                .query(`
                    SELECT
                        LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS Indicateur,
                        COALESCE(
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), ''),
                            'Sans processus'
                        ) AS Processus,
                        COALESCE(
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Designation, CHAR(13), ''), CHAR(10), ''))), ''),
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), ''),
                            '-'
                        ) AS Designation,
                        LTRIM(RTRIM(REPLACE(REPLACE(i.Signe, CHAR(13), ''), CHAR(10), ''))) AS Signe,
                        linked_responsable.Responsable,
                        linked_action_responsable.ActionResponsable,
                        TRY_CONVERT(DECIMAL(18, 4), oc.janv) AS objective_janv,
                        TRY_CONVERT(DECIMAL(18, 4), oc.fev) AS objective_fev,
                        TRY_CONVERT(DECIMAL(18, 4), oc.mars) AS objective_mars,
                        TRY_CONVERT(DECIMAL(18, 4), oc.avril) AS objective_avril,
                        TRY_CONVERT(DECIMAL(18, 4), oc.mai) AS objective_mai,
                        TRY_CONVERT(DECIMAL(18, 4), oc.juin) AS objective_juin,
                        TRY_CONVERT(DECIMAL(18, 4), oc.juil) AS objective_juil,
                        TRY_CONVERT(DECIMAL(18, 4), oc.aout) AS objective_aout,
                        TRY_CONVERT(DECIMAL(18, 4), oc.sept) AS objective_sept,
                        TRY_CONVERT(DECIMAL(18, 4), oc.oct) AS objective_oct,
                        TRY_CONVERT(DECIMAL(18, 4), oc.nov) AS objective_nov,
                        TRY_CONVERT(DECIMAL(18, 4), oc.decem) AS objective_decem,
                        TRY_CONVERT(DECIMAL(18, 4), rc.janv) AS realise_janv,
                        TRY_CONVERT(DECIMAL(18, 4), rc.fev) AS realise_fev,
                        TRY_CONVERT(DECIMAL(18, 4), rc.mars) AS realise_mars,
                        TRY_CONVERT(DECIMAL(18, 4), rc.avril) AS realise_avril,
                        TRY_CONVERT(DECIMAL(18, 4), rc.mai) AS realise_mai,
                        TRY_CONVERT(DECIMAL(18, 4), rc.juin) AS realise_juin,
                        TRY_CONVERT(DECIMAL(18, 4), rc.juil) AS realise_juil,
                        TRY_CONVERT(DECIMAL(18, 4), rc.aout) AS realise_aout,
                        TRY_CONVERT(DECIMAL(18, 4), rc.sept) AS realise_sept,
                        TRY_CONVERT(DECIMAL(18, 4), rc.oct) AS realise_oct,
                        TRY_CONVERT(DECIMAL(18, 4), rc.nov) AS realise_nov,
                        TRY_CONVERT(DECIMAL(18, 4), rc.decem) AS realise_decem
                    FROM dbo.Indicateur AS i
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
                    OUTER APPLY (
                        SELECT TOP 1
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS Responsable
                        FROM dbo.responsable AS resp
                        WHERE
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        ORDER BY
                            CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                            TRY_CONVERT(INT, resp.code_responsable),
                            resp.code_responsable
                    ) AS linked_responsable
                    OUTER APPLY (
                        SELECT TOP 1
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable_action, CHAR(13), ''), CHAR(10), ''))), '') AS ActionResponsable
                        FROM dbo.responsable AS resp
                        WHERE
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                            NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                            AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable_action, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
                        ORDER BY
                            CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                            TRY_CONVERT(INT, resp.code_responsable),
                            resp.code_responsable
                    ) AS linked_action_responsable
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
                `),
            pool.request()
                .input('selectedYear', sql.Int, selectedYear)
                .query(`
                    WITH ranked_actions AS (
                        SELECT
                            LTRIM(RTRIM(CAST(pa.Indicateur AS NVARCHAR(255)))) AS Indicateur,
                            TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.annee AS NVARCHAR(50)))), '')) AS annee,
                            TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.mois AS NVARCHAR(50)))), '')) AS mois,
                            NULLIF(LTRIM(RTRIM(CAST(pa.rootCause AS NVARCHAR(2000)))), '') AS rootCause,
                            NULLIF(LTRIM(RTRIM(CAST(pa.action AS NVARCHAR(2000)))), '') AS action,
                            NULLIF(LTRIM(RTRIM(CAST(pa.responsable AS NVARCHAR(255)))), '') AS responsable,
                            NULLIF(LTRIM(RTRIM(CAST(pa.dateclotprevu AS NVARCHAR(100)))), '') AS dateclotprevu,
                            NULLIF(LTRIM(RTRIM(CAST(pa.datecreation AS NVARCHAR(100)))), '') AS datecreation,
                            NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), '') AS efficacit,
                            NULLIF(LTRIM(RTRIM(CAST(pa.dateclot AS NVARCHAR(100)))), '') AS dateclot,
                            TRY_CONVERT(DECIMAL(10, 2), pa.PROGRESS) AS PROGRESS,
                            ROW_NUMBER() OVER (
                                PARTITION BY
                                    LTRIM(RTRIM(CAST(pa.Indicateur AS NVARCHAR(255)))),
                                    TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.annee AS NVARCHAR(50)))), '')),
                                    TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.mois AS NVARCHAR(50)))), ''))
                                ORDER BY
                                    COALESCE(TRY_CONVERT(datetime, pa.datecreation), TRY_CONVERT(datetime, GETDATE())) DESC,
                                    TRY_CONVERT(datetime, pa.dateclot) DESC
                            ) AS rn
                        FROM dbo.Plan_action AS pa
                        WHERE TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.annee AS NVARCHAR(50)))), '')) = @selectedYear
                    )
                    SELECT *
                    FROM ranked_actions
                    WHERE rn = 1
                `),
        ]);

        const monthEntries = VALID_MONTH_COLUMNS.map((key, index) => ({ key, month: index + 1 }));
        const actionMap = new Map();

        actionResult.recordset.forEach((row) => {
            const indicatorKey = sanitizeNullableText(row.Indicateur);
            const actionYear = Number.parseInt(row.annee, 10);
            const actionMonth = Number.parseInt(row.mois, 10);

            if (!indicatorKey || !Number.isInteger(actionYear) || !Number.isInteger(actionMonth)) {
                return;
            }

            actionMap.set(`${indicatorKey.toLowerCase()}__${actionYear}__${actionMonth}`, row);
        });

        const rows = [];

        indicatorResult.recordset.forEach((row) => {
            const indicatorCode = sanitizeNullableText(row.Indicateur);
            const processusName = sanitizeNullableText(row.Processus) || 'Sans processus';
            const designation = sanitizeNullableText(row.Designation) || indicatorCode || '-';

            if (!indicatorCode) {
                return;
            }

            monthEntries.forEach(({ key, month }) => {
                if (selectedMonth !== null && month !== selectedMonth) {
                    return;
                }

                const objectiveValue = toNullableNumber(row[`objective_${key}`]);
                if (objectiveValue === null) {
                    return;
                }

                const realiseValue = toNullableNumber(row[`realise_${key}`]);
                if (realiseValue === null) {
                    return;
                }

                const underTarget = !reachesObjective(realiseValue, objectiveValue, row.Signe);
                if (!underTarget) {
                    return;
                }

                const existingAction = actionMap.get(`${indicatorCode.toLowerCase()}__${selectedYear}__${month}`) || null;
                const fallbackResponsable =
                    sanitizeNullableText(row.ActionResponsable)
                    || sanitizeNullableText(row.Responsable)
                    || null;
                const progressValue = toNullableNumber(existingAction?.PROGRESS);
                const hasPlanInfo = Boolean(
                    existingAction && (
                        sanitizeNullableText(existingAction.rootCause)
                        || sanitizeNullableText(existingAction.action)
                        || sanitizeNullableText(existingAction.responsable)
                        || sanitizeNullableText(existingAction.dateclotprevu)
                        || sanitizeNullableText(existingAction.datecreation)
                        || sanitizeNullableText(existingAction.efficacit)
                        || sanitizeNullableText(existingAction.dateclot)
                        || progressValue !== null
                    )
                );

                rows.push({
                    Indicateur: indicatorCode,
                    Processus: processusName,
                    Designation: designation,
                    responsable:
                        sanitizeNullableText(existingAction?.responsable)
                        || fallbackResponsable
                        || '-',
                    actionResponsable: fallbackResponsable || '',
                    mois: String(month),
                    annee: String(selectedYear),
                    rootCause: sanitizeNullableText(existingAction?.rootCause) || '',
                    action: sanitizeNullableText(existingAction?.action) || '',
                    dateclotprevu: sanitizeNullableText(existingAction?.dateclotprevu) || '',
                    datecreation: sanitizeNullableText(existingAction?.datecreation) || '',
                    efficacit: sanitizeNullableText(existingAction?.efficacit) || '',
                    PROGRESS: progressValue,
                    statusText: 'under-target',
                    pendingReason: 'under-target',
                    hasPlanInfo: hasPlanInfo ? 1 : 0,
                    dateclot: sanitizeNullableText(existingAction?.dateclot) || '',
                    objectiveValue,
                    realiseValue,
                });
            });
        });

        rows.sort((left, right) => {
            const yearCompare = Number(right.annee) - Number(left.annee);
            if (yearCompare !== 0) {
                return yearCompare;
            }

            const monthCompare = Number(right.mois) - Number(left.mois);
            if (monthCompare !== 0) {
                return monthCompare;
            }

            const processCompare = String(left.Processus).localeCompare(String(right.Processus), 'fr');
            if (processCompare !== 0) {
                return processCompare;
            }

            return String(left.Designation || left.Indicateur).localeCompare(
                String(right.Designation || right.Indicateur),
                'fr'
            );
        });

        res.json({ rows });
    } catch (error) {
        console.error('Error fetching pending plan actions:', error);
        res.status(500).json({ error: 'Failed to fetch pending plan actions', details: error.message });
    }
});

// Legacy route kept only for reference; superseded by the authenticated monthly pending route above.
router.get('/plan-action/pending-legacy', async (req, res) => {
    try {
        await ensureIndicatorAssignmentsTable();
        await ensureResponsableActionColumn();
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT
                LTRIM(RTRIM(REPLACE(REPLACE(CAST(pa.Indicateur AS NVARCHAR(255)), CHAR(13), ''), CHAR(10), ''))) AS Indicateur,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), ''),
                    'Sans processus'
                ) AS Processus,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Designation, CHAR(13), ''), CHAR(10), ''))), ''),
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(CAST(pa.Indicateur AS NVARCHAR(255)), CHAR(13), ''), CHAR(10), ''))), ''),
                    '-'
                ) AS Designation,
                COALESCE(
                    linked_action_responsable.ActionResponsable,
                    NULLIF(LTRIM(RTRIM(CAST(pa.responsable AS NVARCHAR(255)))), ''),
                    linked_responsable.Responsable,
                    '-'
                ) AS responsable,
                COALESCE(
                    linked_action_responsable.ActionResponsable,
                    NULLIF(LTRIM(RTRIM(CAST(pa.responsable AS NVARCHAR(255)))), ''),
                    linked_responsable.Responsable
                ) AS actionResponsable,
                NULLIF(LTRIM(RTRIM(CAST(pa.mois AS NVARCHAR(50)))), '') AS mois,
                NULLIF(LTRIM(RTRIM(CAST(pa.annee AS NVARCHAR(50)))), '') AS annee,
                NULLIF(LTRIM(RTRIM(CAST(pa.rootCause AS NVARCHAR(2000)))), '') AS rootCause,
                NULLIF(LTRIM(RTRIM(CAST(pa.action AS NVARCHAR(2000)))), '') AS action,
                NULLIF(LTRIM(RTRIM(CAST(pa.dateclotprevu AS NVARCHAR(100)))), '') AS dateclotprevu,
                NULLIF(LTRIM(RTRIM(CAST(pa.datecreation AS NVARCHAR(100)))), '') AS datecreation,
                NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), '') AS efficacit,
                pending.progress_value AS PROGRESS,
                pending.status_text AS statusText,
                pending.pending_reason AS pendingReason,
                pending.has_plan_info AS hasPlanInfo,
                pending.dateclot_text AS dateclot
            FROM dbo.Plan_action AS pa
            LEFT JOIN dbo.Indicateur AS i
                ON
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(CAST(pa.Indicateur AS NVARCHAR(255)), CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS Responsable
                FROM dbo.responsable AS resp
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(CAST(pa.Indicateur AS NVARCHAR(255)), CHAR(13), ''), CHAR(10), ''))), '')
                ORDER BY
                    CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                    TRY_CONVERT(INT, resp.code_responsable),
                    resp.code_responsable
            ) AS linked_responsable
            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable_action, CHAR(13), ''), CHAR(10), ''))), '') AS ActionResponsable
                FROM dbo.responsable AS resp
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(CAST(pa.Indicateur AS NVARCHAR(255)), CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable_action, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
                ORDER BY
                    CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                    TRY_CONVERT(INT, resp.code_responsable),
                    resp.code_responsable
            ) AS linked_action_responsable
            CROSS APPLY (
                SELECT
                    COALESCE(
                        TRY_CONVERT(DECIMAL(10, 2), pa.PROGRESS),
                        TRY_CONVERT(
                            DECIMAL(10, 2),
                            REPLACE(
                                REPLACE(
                                    NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), ''),
                                    '%',
                                    ''
                                ),
                                ',',
                                '.'
                            )
                        )
                    ) AS progress_value,
                    NULLIF(LTRIM(RTRIM(CAST(pa.dateclot AS NVARCHAR(100)))), '') AS dateclot_text,
                    LOWER(NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), '')) AS status_text,
                    CASE
                        WHEN NULLIF(LTRIM(RTRIM(CAST(pa.rootCause AS NVARCHAR(2000)))), '') IS NOT NULL
                             OR NULLIF(LTRIM(RTRIM(CAST(pa.action AS NVARCHAR(2000)))), '') IS NOT NULL
                             OR NULLIF(LTRIM(RTRIM(CAST(pa.responsable AS NVARCHAR(255)))), '') IS NOT NULL
                             OR linked_action_responsable.ActionResponsable IS NOT NULL
                             OR linked_responsable.Responsable IS NOT NULL
                             OR NULLIF(LTRIM(RTRIM(CAST(pa.dateclotprevu AS NVARCHAR(100)))), '') IS NOT NULL
                             OR NULLIF(LTRIM(RTRIM(CAST(pa.datecreation AS NVARCHAR(100)))), '') IS NOT NULL
                        THEN CAST(1 AS BIT)
                        ELSE CAST(0 AS BIT)
                    END AS has_plan_info,
                    CASE
                        WHEN COALESCE(
                                TRY_CONVERT(DECIMAL(10, 2), pa.PROGRESS),
                                TRY_CONVERT(
                                    DECIMAL(10, 2),
                                    REPLACE(
                                        REPLACE(
                                            NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), ''),
                                            '%',
                                            ''
                                        ),
                                        ',',
                                        '.'
                                    )
                                )
                             ) IS NOT NULL
                             AND COALESCE(
                                TRY_CONVERT(DECIMAL(10, 2), pa.PROGRESS),
                                TRY_CONVERT(
                                    DECIMAL(10, 2),
                                    REPLACE(
                                        REPLACE(
                                            NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), ''),
                                            '%',
                                            ''
                                        ),
                                        ',',
                                        '.'
                                    )
                                )
                             ) < 100
                            THEN 'progress-under-100'
                        WHEN LOWER(NULLIF(LTRIM(RTRIM(CAST(pa.efficacit AS NVARCHAR(200)))), '')) IN (
                            'not realized',
                            'not realised',
                            'non realise',
                            'non realisee',
                            'non realisees',
                            'non realis�',
                            'non r�alis�e',
                            'non r�alis�es',
                            'not done',
                            'pending',
                            'in progress',
                            'open'
                        )
                            THEN 'status-pending'
                        WHEN NULLIF(LTRIM(RTRIM(CAST(pa.dateclot AS NVARCHAR(100)))), '') IS NULL
                            THEN 'not-closed'
                        ELSE 'other'
                    END AS pending_reason
            ) AS pending
            WHERE
                pending.progress_value < 100
                OR pending.dateclot_text IS NULL
                OR pending.status_text IN (
                    'not realized',
                    'not realised',
                    'non realise',
                    'non realisee',
                    'non realisees',
                    'non realis�',
                    'non r�alis�e',
                    'non r�alis�es',
                    'non realisee',
                    'not done',
                    'pending',
                    'in progress',
                    'open'
                )
                OR pending.status_text LIKE '%not%real%'
                OR pending.status_text LIKE '%non%real%'
            ORDER BY
                CASE WHEN TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.annee AS NVARCHAR(50)))), '')) IS NULL THEN 1 ELSE 0 END,
                TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.annee AS NVARCHAR(50)))), '')) DESC,
                CASE WHEN TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.mois AS NVARCHAR(50)))), '')) IS NULL THEN 1 ELSE 0 END,
                TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(CAST(pa.mois AS NVARCHAR(50)))), '')) DESC,
                CASE
                    WHEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') IS NULL THEN 1
                    ELSE 0
                END,
                i.Processus,
                CAST(pa.Indicateur AS NVARCHAR(255))
        `);

        res.json({
            rows: result.recordset
        });
    } catch (error) {
        console.error('Error fetching pending plan actions:', error);
        res.status(500).json({ error: 'Failed to fetch pending plan actions', details: error.message });
    }
});

// GET /api/dashboard/processus/:processus - Get dashboard rows for a Processus
router.get('/processus/:processus', async (req, res) => {
    try {
        const { processus } = req.params;
        const parsedYear = Number.parseInt(req.query.year, 10);
        const period = req.query.period || 'mensuelle'; // mensuelle, trimestrielle, annuelle
        const currentYear = new Date().getFullYear();
        const selectedYear = Number.isInteger(parsedYear) ? parsedYear : currentYear;
        const previousYear = selectedYear - 1;

        if (!processus || !processus.trim()) {
            return res.status(400).json({ error: 'Processus is required' });
        }

        await ensureIndicatorAssignmentsTable();
        await ensureIndicatorDescriptionsYearTable();
        await ensureResponsableActionColumn();
        await ensureIndicatorYearTable();

        const pool = await poolPromise;
        const request = pool.request();
        request.input('processus', sql.NVarChar(255), processus.trim());
        request.input('selectedYear', sql.Int, selectedYear);
        request.input('previousYear', sql.Int, previousYear);
        request.input('period', sql.NVarChar(50), period);

        const result = await request.query(`
            SELECT
                TRY_CONVERT(INT, i.Nordre) AS Nordre,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))) AS Indicateur,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))) AS Processus,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Designation, CHAR(13), ''), CHAR(10), ''))) AS Designation,
                COALESCE(
                yd.DescriptionYear,
                LTRIM(RTRIM(REPLACE(REPLACE(i.Description, CHAR(13), ''), CHAR(10), '')))
                ) AS Description,
                COALESCE(iy_selected.Signe, LTRIM(RTRIM(REPLACE(REPLACE(i.Signe, CHAR(13), ''), CHAR(10), '')))) AS Signe,
                COALESCE(iy_selected.Unite, LTRIM(RTRIM(REPLACE(REPLACE(i.Unite, CHAR(13), ''), CHAR(10), '')))) AS Unite,
                ia.Pilote AS Pilote,
                COALESCE(ia.Responsable, rs_legacy.Responsable) AS Responsable,
                action_assignment.ActionResponsable AS ActionResponsable,
                ia.UserId AS UserId,
                COALESCE(up_user.UserName, ia.UserName, ia.Responsable, rs_legacy.Responsable) AS UserName,
                plan_action.PROGRESS AS PROGRESS,
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
                calc.objective_moyenne_current,
                calc.objective_moyenne_previous,
                calc.objective_tendance,
                calc.realise_moyenne_current,
                calc.realise_moyenne_previous,
                calc.realise_tendance,
                calc.period_type_match
            FROM dbo.Indicateur AS i
            OUTER APPLY (
                SELECT TOP 1
                    1 AS HasSelectedYear,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.Signe, CHAR(13), ''), CHAR(10), ''))), '') AS Signe,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.Unite, CHAR(13), ''), CHAR(10), ''))), '') AS Unite
                FROM dbo.Indicateur_Annee AS y
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                    AND TRY_CONVERT(INT, y.Annee) = @selectedYear
            ) AS iy_selected
            OUTER APPLY (
                SELECT TOP 1 1 AS HasAnyYear
                FROM dbo.Indicateur_Annee AS y
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(y.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
            ) AS iy_any
            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.pilote_name, CHAR(13), ''), CHAR(10), ''))), '') AS Pilote,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.responsable_name, CHAR(13), ''), CHAR(10), ''))), '') AS Responsable,
                    ass.user_id AS UserId,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(u.username, CHAR(13), ''), CHAR(10), ''))), '') AS UserName
                FROM dbo.indicator_assignments AS ass
                LEFT JOIN dbo.users AS u ON u.id = ass.user_id
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(ass.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                ORDER BY
                    COALESCE(ass.updated_at, ass.created_at) DESC,
                    ass.id DESC
            ) AS ia
            OUTER APPLY (
            SELECT TOP 1
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(d.description, CHAR(13), ''), CHAR(10), ''))), '') AS DescriptionYear
            FROM dbo.indicator_descriptions_year AS d
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(d.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                AND d.[year] = @selectedYear
            ORDER BY d.updated_at DESC, d.id DESC
        ) AS yd

            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS Responsable
                FROM dbo.responsable AS resp
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                ORDER BY
                    CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                    TRY_CONVERT(INT, resp.code_responsable),
                    resp.code_responsable
            ) AS rs_legacy
            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable_action, CHAR(13), ''), CHAR(10), ''))), '') AS ActionResponsable
                FROM dbo.responsable AS resp
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(resp.responsable_action, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
                ORDER BY
                    CASE WHEN TRY_CONVERT(INT, resp.code_responsable) IS NULL THEN 1 ELSE 0 END,
                    TRY_CONVERT(INT, resp.code_responsable),
                    resp.code_responsable
            ) AS action_assignment
            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(u.username, CHAR(13), ''), CHAR(10), ''))), '') AS UserName
                FROM dbo.user_permissions AS up
                INNER JOIN dbo.users AS u ON u.id = up.user_id
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '')
                ORDER BY
                    up.created_at DESC,
                    up.id DESC
            ) AS up_user
            OUTER APPLY (
                SELECT TOP 1
                    pa.PROGRESS
                FROM dbo.Plan_action AS pa
                WHERE
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(pa.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(pa.annee)), '')) = @selectedYear
                ORDER BY
                    pa.datecreation DESC, pa.dateclot DESC
            ) AS plan_action
            OUTER APPLY (
                SELECT TOP 1 o.*
                FROM dbo.objectiv AS o
                WHERE
                    o.indicateur = i.Indicateur
                    AND YEAR(COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow))) = @selectedYear
                ORDER BY
                    COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow)) DESC,
                    TRY_CONVERT(datetime, o.datenow) DESC
            ) AS o_current
            OUTER APPLY (
                SELECT TOP 1 o.*
                FROM dbo.objectiv AS o
                WHERE
                    o.indicateur = i.Indicateur
                    AND YEAR(COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow))) = @previousYear
                ORDER BY
                    COALESCE(TRY_CONVERT(date, o.date1), TRY_CONVERT(date, o.datenow)) DESC,
                    TRY_CONVERT(datetime, o.datenow) DESC
            ) AS o_previous
            -- Infer period_type for current year from objectiv data pattern
            OUTER APPLY (
                SELECT TOP 1
                    CASE
                        WHEN (o_current.janv IS NOT NULL AND o_current.fev IS NOT NULL AND o_current.mars IS NOT NULL AND o_current.janv = o_current.fev AND o_current.fev = o_current.mars)
                          OR (o_current.avril IS NOT NULL AND o_current.mai IS NOT NULL AND o_current.juin IS NOT NULL AND o_current.avril = o_current.mai AND o_current.mai = o_current.juin)
                          OR (o_current.juil IS NOT NULL AND o_current.aout IS NOT NULL AND o_current.sept IS NOT NULL AND o_current.juil = o_current.aout AND o_current.aout = o_current.sept)
                          OR (o_current.oct IS NOT NULL AND o_current.nov IS NOT NULL AND o_current.decem IS NOT NULL AND o_current.oct = o_current.nov AND o_current.nov = o_current.decem)
                        THEN 'quarter'
                        ELSE 'month'
                    END AS period_type
            ) AS period_current
            -- Infer period_type for previous year from objectiv data pattern
            OUTER APPLY (
                SELECT TOP 1
                    CASE
                        WHEN (o_previous.janv IS NOT NULL AND o_previous.fev IS NOT NULL AND o_previous.mars IS NOT NULL AND o_previous.janv = o_previous.fev AND o_previous.fev = o_previous.mars)
                          OR (o_previous.avril IS NOT NULL AND o_previous.mai IS NOT NULL AND o_previous.juin IS NOT NULL AND o_previous.avril = o_previous.mai AND o_previous.mai = o_previous.juin)
                          OR (o_previous.juil IS NOT NULL AND o_previous.aout IS NOT NULL AND o_previous.sept IS NOT NULL AND o_previous.juil = o_previous.aout AND o_previous.aout = o_previous.sept)
                          OR (o_previous.oct IS NOT NULL AND o_previous.nov IS NOT NULL AND o_previous.decem IS NOT NULL AND o_previous.oct = o_previous.nov AND o_previous.nov = o_previous.decem)
                        THEN 'quarter'
                        ELSE 'month'
                    END AS period_type
            ) AS period_previous
            OUTER APPLY (
                SELECT TOP 1 r.*
                FROM dbo.realise AS r
                WHERE
                    r.indicateur = i.Indicateur
                    AND YEAR(COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow))) = @selectedYear
                ORDER BY
                    COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow)) DESC,
                    TRY_CONVERT(datetime, r.datenow) DESC
            ) AS r_current
            OUTER APPLY (
                SELECT TOP 1 r.*
                FROM dbo.realise AS r
                WHERE
                    r.indicateur = i.Indicateur
                    AND YEAR(COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow))) = @previousYear
                ORDER BY
                    COALESCE(TRY_CONVERT(date, r.date1), TRY_CONVERT(date, r.datenow)) DESC,
                    TRY_CONVERT(datetime, r.datenow) DESC
            ) AS r_previous
            CROSS APPLY (
                SELECT
                    TRY_CONVERT(DECIMAL(18, 4), o_current.janv) AS janv,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.fev) AS fev,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.mars) AS mars,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.avril) AS avril,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.mai) AS mai,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.juin) AS juin,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.juil) AS juil,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.aout) AS aout,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.sept) AS sept,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.oct) AS oct,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.nov) AS nov,
                    TRY_CONVERT(DECIMAL(18, 4), o_current.decem) AS decem
            ) AS oc
            CROSS APPLY (
                SELECT
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.janv) AS janv,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.fev) AS fev,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.mars) AS mars,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.avril) AS avril,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.mai) AS mai,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.juin) AS juin,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.juil) AS juil,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.aout) AS aout,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.sept) AS sept,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.oct) AS oct,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.nov) AS nov,
                    TRY_CONVERT(DECIMAL(18, 4), o_previous.decem) AS decem
            ) AS op
            CROSS APPLY (
                SELECT
                    TRY_CONVERT(DECIMAL(18, 4), r_current.janv) AS janv,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.fev) AS fev,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.mars) AS mars,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.avril) AS avril,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.mai) AS mai,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.juin) AS juin,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.juil) AS juil,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.aout) AS aout,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.sept) AS sept,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.oct) AS oct,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.nov) AS nov,
                    TRY_CONVERT(DECIMAL(18, 4), r_current.decem) AS decem
            ) AS rc
            CROSS APPLY (
                SELECT
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.janv) AS janv,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.fev) AS fev,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.mars) AS mars,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.avril) AS avril,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.mai) AS mai,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.juin) AS juin,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.juil) AS juil,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.aout) AS aout,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.sept) AS sept,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.oct) AS oct,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.nov) AS nov,
                    TRY_CONVERT(DECIMAL(18, 4), r_previous.decem) AS decem
            ) AS rp
            CROSS APPLY (
                SELECT
                    ROUND(
                        (
                            COALESCE(oc.janv, 0) + COALESCE(oc.fev, 0) + COALESCE(oc.mars, 0) + COALESCE(oc.avril, 0) +
                            COALESCE(oc.mai, 0) + COALESCE(oc.juin, 0) + COALESCE(oc.juil, 0) + COALESCE(oc.aout, 0) +
                            COALESCE(oc.sept, 0) + COALESCE(oc.oct, 0) + COALESCE(oc.nov, 0) + COALESCE(oc.decem, 0)
                        )
                        /
                        NULLIF(
                            (CASE WHEN oc.janv IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.fev IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.mars IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.avril IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.mai IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.juin IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.juil IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.aout IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.sept IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.oct IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.nov IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN oc.decem IS NOT NULL THEN 1 ELSE 0 END),
                            0
                        ),
                        2
                    ) AS objective_moyenne_current,
                    ROUND(
                        (
                            COALESCE(op.janv, 0) + COALESCE(op.fev, 0) + COALESCE(op.mars, 0) + COALESCE(op.avril, 0) +
                            COALESCE(op.mai, 0) + COALESCE(op.juin, 0) + COALESCE(op.juil, 0) + COALESCE(op.aout, 0) +
                            COALESCE(op.sept, 0) + COALESCE(op.oct, 0) + COALESCE(op.nov, 0) + COALESCE(op.decem, 0)
                        )
                        /
                        NULLIF(
                            (CASE WHEN op.janv IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.fev IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.mars IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.avril IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.mai IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.juin IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.juil IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.aout IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.sept IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.oct IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.nov IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN op.decem IS NOT NULL THEN 1 ELSE 0 END),
                            0
                        ),
                        2
                    ) AS objective_moyenne_previous,
                    ROUND(
                        (
                            COALESCE(rc.janv, 0) + COALESCE(rc.fev, 0) + COALESCE(rc.mars, 0) + COALESCE(rc.avril, 0) +
                            COALESCE(rc.mai, 0) + COALESCE(rc.juin, 0) + COALESCE(rc.juil, 0) + COALESCE(rc.aout, 0) +
                            COALESCE(rc.sept, 0) + COALESCE(rc.oct, 0) + COALESCE(rc.nov, 0) + COALESCE(rc.decem, 0)
                        )
                        /
                        NULLIF(
                            (CASE WHEN rc.janv IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.fev IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.mars IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.avril IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.mai IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.juin IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.juil IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.aout IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.sept IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.oct IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.nov IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rc.decem IS NOT NULL THEN 1 ELSE 0 END),
                            0
                        ),
                        2
                    ) AS realise_moyenne_current,
                    ROUND(
                        (
                            COALESCE(rp.janv, 0) + COALESCE(rp.fev, 0) + COALESCE(rp.mars, 0) + COALESCE(rp.avril, 0) +
                            COALESCE(rp.mai, 0) + COALESCE(rp.juin, 0) + COALESCE(rp.juil, 0) + COALESCE(rp.aout, 0) +
                            COALESCE(rp.sept, 0) + COALESCE(rp.oct, 0) + COALESCE(rp.nov, 0) + COALESCE(rp.decem, 0)
                        )
                        /
                        NULLIF(
                            (CASE WHEN rp.janv IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.fev IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.mars IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.avril IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.mai IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.juin IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.juil IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.aout IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.sept IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.oct IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.nov IS NOT NULL THEN 1 ELSE 0 END) +
                            (CASE WHEN rp.decem IS NOT NULL THEN 1 ELSE 0 END),
                            0
                        ),
                        2
                    ) AS realise_moyenne_previous,
                    -- Check if period types match between current and previous year
                    CASE
                        WHEN period_current.period_type IS NULL OR period_previous.period_type IS NULL THEN 1
                        WHEN period_current.period_type = period_previous.period_type THEN 1
                        ELSE 0
                    END AS period_type_match
            ) AS avg_calc
            CROSS APPLY (
                SELECT
                    avg_calc.objective_moyenne_current,
                    avg_calc.objective_moyenne_previous,
                    CASE
                        WHEN avg_calc.period_type_match = 0 THEN NULL
                        WHEN avg_calc.objective_moyenne_current IS NULL
                            OR avg_calc.objective_moyenne_previous IS NULL
                            OR avg_calc.objective_moyenne_previous = 0
                            THEN NULL
                        ELSE ROUND(((avg_calc.objective_moyenne_current / avg_calc.objective_moyenne_previous) - 1) * 100.0, 2)
                    END AS objective_tendance,
                    avg_calc.realise_moyenne_current,
                    avg_calc.realise_moyenne_previous,
                    CASE
                        WHEN avg_calc.period_type_match = 0 THEN NULL
                        WHEN avg_calc.realise_moyenne_current IS NULL
                            OR avg_calc.realise_moyenne_previous IS NULL
                            OR avg_calc.realise_moyenne_previous = 0
                            THEN NULL
                        ELSE ROUND(((avg_calc.realise_moyenne_current / avg_calc.realise_moyenne_previous) - 1) * 100.0, 2)
                    END AS realise_tendance,
                    avg_calc.period_type_match
            ) AS calc
            WHERE
                NULLIF(
                    LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))),
                    ''
                ) = @processus
                AND (iy_any.HasAnyYear IS NULL OR iy_selected.HasSelectedYear = 1)
            ORDER BY
                CASE WHEN TRY_CONVERT(INT, i.Nordre) IS NULL THEN 1 ELSE 0 END,
                TRY_CONVERT(INT, i.Nordre),
                i.Indicateur
        `);

        res.json({
            processus: processus.trim(),
            selectedYear,
            previousYear,
            rows: result.recordset
        });
    } catch (error) {
        console.error('Error fetching dashboard rows:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard rows', details: error.message });
    }
});

// Helper: get next Nordre value
const getNextNordre = async (pool) => {
    const r = await pool.request().query(
        `SELECT COALESCE(MAX(TRY_CONVERT(INT, NULLIF(LTRIM(RTRIM(Nordre)), ''))), 0) + 1 AS next FROM dbo.Indicateur`
    );
    return r.recordset[0].next || 1;
};

// Helper: insert responsable (non-blocking)
const insertResponsable = async (pool, indicateur, responsable, code) => {
    try {
        await pool.request()
            .input('indicateur', sql.NVarChar(255), indicateur)
            .input('responsable', sql.NVarChar(255), responsable)
            .input('code', sql.NVarChar(50), String(code))
            .query(`INSERT INTO dbo.responsable (indicateur, responsable, code_responsable) VALUES (@indicateur, @responsable, @code)`);
    } catch (e) {
        console.warn('Could not insert responsable (non-blocking):', e.message);
    }
};

const toAsciiUpper = (value) =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

const toAsciiLower = (value) => toAsciiUpper(value).toLowerCase();

const extractProcessusCodePrefix = (processus) => {
    const normalized = sanitizeNullableText(processus);
    if (!normalized) {
        return '';
    }

    const structuredMatch = normalized.match(/^([A-Za-z]{1,4}\d{1,6})/);
    if (structuredMatch && structuredMatch[1]) {
        return toAsciiUpper(structuredMatch[1]).replace(/[^A-Z0-9]/g, '');
    }

    const firstToken = normalized.split(/\s+/)[0] || normalized;
    return toAsciiUpper(firstToken).replace(/[^A-Z0-9]/g, '');
};

const toStorageIndicatorPrefix = (value) => {
    const cleaned = toAsciiUpper(value).replace(/[^A-Z0-9]/g, '');
    if (!cleaned) {
        return '';
    }

    const match = cleaned.match(/^([A-Z]{1,4})(\d{1,6})$/);
    if (!match) {
        return cleaned.toLowerCase();
    }

    const [, letters, digits] = match;
    const parsedNumber = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
        return letters.toLowerCase();
    }

    return `${letters.toLowerCase()}${parsedNumber}`;
};

const INDICATOR_CODE_SUFFIX_LENGTH = 10;

const extractDesignationCodeChunk = (designation) => {
    const normalized = toAsciiLower(designation)
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();
    const compact = normalized.replace(/\s+/g, '');
    if (!compact) {
        return '';
    }

    return compact.slice(0, INDICATOR_CODE_SUFFIX_LENGTH);
};

const buildIndicatorCodeBaseFromProcessus = (processus, designation) => {
    const prefix = toStorageIndicatorPrefix(extractProcessusCodePrefix(processus));
    if (!prefix) {
        return '';
    }

    const suffix = extractDesignationCodeChunk(designation);
    return suffix ? `${prefix}_${suffix}` : prefix;
};

const indicatorCodeExists = async (db, indicatorCode) => {
    const normalized = sanitizeNullableText(indicatorCode);
    if (!normalized) {
        return false;
    }

    const result = await db.request()
        .input('indicateur', sql.NVarChar(255), normalized)
        .query(`
            SELECT TOP 1 1 AS exists_flag
            FROM dbo.Indicateur
            WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(Indicateur, CHAR(13),''), CHAR(10),''))), '') = @indicateur
        `);

    return result.recordset.length > 0;
};

const resolveUniqueIndicatorCode = async (db, baseCode, reservedCodes = new Set()) => {
    const normalizedBase = sanitizeNullableText(baseCode);
    if (!normalizedBase) {
        return '';
    }

    let candidate = normalizedBase;
    let suffix = 2;

    while (reservedCodes.has(candidate) || await indicatorCodeExists(db, candidate)) {
        candidate = `${normalizedBase}_${suffix}`;
        suffix += 1;
    }

    reservedCodes.add(candidate);
    return candidate;
};

// POST /api/dashboard/processus - Create new processus with 1..N indicators
router.post('/processus', authMiddleware, async (req, res) => {
    try {
        const { processus, indicators, responsable, pilote, Annee } = req.body;

        const trimmedProcessus = sanitizeNullableText(processus);
        const defaultResponsable = sanitizeNullableText(responsable);
        const defaultPilote = sanitizeNullableText(pilote);
        const selectedYear = normalizeYear(Annee);

        if (!trimmedProcessus) {
            return res.status(400).json({ error: 'Processus name is required' });
        }

        const pool = await poolPromise;
        await ensureIndicatorAssignmentsTable();

        // Check if processus already exists
        const checkResult = await pool.request()
            .input('processus', sql.NVarChar(255), trimmedProcessus)
            .query(`SELECT COUNT(*) AS cnt FROM dbo.Indicateur
                    WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(Processus, CHAR(13),''), CHAR(10),''))), '') = @processus`);

        if (checkResult.recordset[0].cnt > 0) {
            return res.status(409).json({ error: `Le processus "${trimmedProcessus}" existe déjà.` });
        }

        const sourceIndicators = Array.isArray(indicators) ? indicators : [];
        const normalizedIndicators = sourceIndicators
            .map((item) => {
                const designationValue = sanitizeNullableText(item?.designation);
                if (!designationValue) {
                    return null;
                }

                return {
                    designation: designationValue,
                    signe: sanitizeNullableText(item?.signe) || '',
                    unite: sanitizeNullableText(item?.unite) || '',
                    responsable: sanitizeNullableText(item?.responsable) || defaultResponsable || '',
                    responsableAction: sanitizeNullableText(item?.responsableAction) || '',
                    pilote: sanitizeNullableText(item?.pilote) || defaultPilote || '',
                };
            })
            .filter(Boolean);

        if (normalizedIndicators.length === 0) {
            return res.status(400).json({ error: 'Au moins une désignation d\'indicateur est requise.' });
        }

        let nextNordre = await getNextNordre(pool);
        const reservedCodes = new Set();

        for (const indicatorData of normalizedIndicators) {
            const baseCode =
                buildIndicatorCodeBaseFromProcessus(trimmedProcessus, indicatorData.designation) ||
                `${toStorageIndicatorPrefix(extractProcessusCodePrefix(trimmedProcessus)) || 'proc'}`;
            const indicatorCode = await resolveUniqueIndicatorCode(pool, baseCode, reservedCodes);

            await pool.request()
                .input('Nordre', sql.NVarChar(50), String(nextNordre))
                .input('indicateur', sql.NVarChar(255), indicatorCode)
                .input('processus', sql.NVarChar(255), trimmedProcessus)
                .input('designation', sql.NVarChar(500), indicatorData.designation || '')
                .input('signe', sql.NVarChar(20), indicatorData.signe || '')
                .input('unite', sql.NVarChar(50), indicatorData.unite || '')
                .query(`INSERT INTO dbo.Indicateur (Nordre, Indicateur, Processus, Designation, Signe, Unite)
                        VALUES (@Nordre, @indicateur, @processus, @designation, @signe, @unite)`);

            if (selectedYear) {
                await upsertIndicatorYear(pool, {
                    idIndicateur: null,
                    idProcessus: null,
                    indicateur: indicatorCode,
                    processus: trimmedProcessus,
                    annee: selectedYear,
                    signe: indicatorData.signe,
                    unite: indicatorData.unite,
                });
            }

            if (indicatorData.responsable) {
                await insertResponsable(pool, indicatorCode, indicatorData.responsable, nextNordre);
                await upsertResponsableAssignment(pool, {
                    processus: trimmedProcessus,
                    indicateur: indicatorCode,
                    responsableName: indicatorData.responsable,
                    updatedBy: req.user?.id ?? null,
                });
            }

            if (indicatorData.pilote) {
                await upsertPiloteAssignment(pool, {
                    processus: trimmedProcessus,
                    indicateur: indicatorCode,
                    piloteName: indicatorData.pilote,
                    updatedBy: req.user?.id ?? null,
                });
            }

            if (indicatorData.responsableAction) {
                await upsertActionResponsableAssignment(pool, {
                    processus: trimmedProcessus,
                    indicateur: indicatorCode,
                    actionResponsableName: indicatorData.responsableAction,
                    updatedBy: req.user?.id ?? null,
                });
            }

            nextNordre++;
        }

        res.status(201).json({
            message: 'Processus créé avec succès',
            processus: trimmedProcessus,
            indicatorsCreated: normalizedIndicators.length
        });
    } catch (error) {
        console.error('Error creating processus:', error);
        res.status(500).json({ error: 'Failed to create processus', details: error.message });
    }
});
// GET /api/dashboard/outils-options - Get available Signe/Unite options (separate lists)
router.get('/outils-options', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;
        const [signesResult, unitesResult] = await Promise.all([
            pool.request().query(`
        SELECT DISTINCT Signe 
        FROM dbo.Outils 
        WHERE NULLIF(LTRIM(RTRIM(Signe)), '') IS NOT NULL
        ORDER BY Signe
      `),
            pool.request().query(`
        SELECT DISTINCT Unite 
        FROM dbo.Outils 
        WHERE NULLIF(LTRIM(RTRIM(Unite)), '') IS NOT NULL
        ORDER BY Unite
      `)
        ]);

        const signes = signesResult.recordset.map(row => row.Signe).filter(Boolean);
        const unites = unitesResult.recordset.map(row => row.Unite).filter(Boolean);

        res.json({ signes, unites });
    } catch (error) {
        console.error('Error fetching outils options:', error);
        res.status(500).json({ error: 'Failed to fetch outils options' });
    }
});

// PUT /api/dashboard/outils/:id - Update existing outil
router.put('/outils/:id', authMiddleware, async (req, res) => {
    try {
        const outilId = req.params.id;
        const { Signe, Unite } = req.body;

        if (!outilId) {
            return res.status(400).json({ error: 'Outil ID required' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, parseInt(outilId))
            .input('signe', sql.NVarChar(255), Signe || null)
            .input('unite', sql.NVarChar(255), Unite || null)
            .query(`
        UPDATE dbo.Outils 
        SET Signe = @signe, Unite = @unite 
        WHERE id = @id;
        SELECT @@ROWCOUNT as updated;
      `);

        if (result.recordset[0].updated === 0) {
            return res.status(404).json({ error: 'Outil not found' });
        }

        res.json({ message: 'Outil updated successfully' });
    } catch (error) {
        console.error('Error updating outil:', error);
        res.status(500).json({ error: 'Failed to update outil', details: error.message });
    }
});

// DELETE /api/dashboard/outils/:id - Delete outil
router.delete('/outils/:id', authMiddleware, async (req, res) => {
    try {
        const outilId = req.params.id;

        if (!outilId) {
            return res.status(400).json({ error: 'Outil ID required' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, parseInt(outilId))
            .query('DELETE FROM dbo.Outils WHERE id = @id; SELECT @@ROWCOUNT as deleted;');

        if (result.recordset[0].deleted === 0) {
            return res.status(404).json({ error: 'Outil not found' });
        }

        res.json({ message: 'Outil deleted successfully' });
    } catch (error) {
        console.error('Error deleting outil:', error);
        res.status(500).json({ error: 'Failed to delete outil', details: error.message });
    }
});

// post /api/dashboard/outils - Create new outil
router.post('/outils', authMiddleware, async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is required (Content-Type: application/json)' });
        }
        const { Signe = '', Unite = '' } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('signe', sql.NVarChar(255), Signe || '')
            .input('unite', sql.NVarChar(255), Unite || '')

            .query(`INSERT INTO dbo.Outils (Signe, Unite) VALUES (@signe, @unite)`);
        res.status(201).json({ message: 'Outil créé avec succès' });
    } catch (error) {
        console.error('Error creating outil:', error);
        res.status(500).json({ error: 'Failed to create outil', details: error.message });
    }
});
// get /api/dashboard/outils - Get all outils
router.get('/outils', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT Signe, Unite FROM dbo.Outils`);
        res.json({ outils: result.recordset });
    } catch (error) {
        console.error('Error fetching outils:', error);
        res.status(500).json({ error: 'Failed to fetch outils', details: error.message });
    }
});

// POST /api/dashboard/indicateur - Create new indicateur (with optional responsable)
router.post('/indicateur', authMiddleware, async (req, res) => {
    try {
        const { processus, designation, signe, unite, responsable, pilote, responsableAction, Annee } = req.body;
        const trimmedProcessus = sanitizeNullableText(processus);
        const trimmedDesignation = sanitizeNullableText(designation);
        const trimmedResponsable = sanitizeNullableText(responsable);
        const trimmedPilote = sanitizeNullableText(pilote);
        const trimmedActionResponsable = sanitizeNullableText(responsableAction);
        const selectedYear = normalizeYear(Annee);

        if (!trimmedProcessus) {
            return res.status(400).json({ error: 'Processus is required' });
        }
        if (!trimmedDesignation) {
            return res.status(400).json({ error: 'Designation is required' });
        }

        const pool = await poolPromise;
        await ensureIndicatorAssignmentsTable();

        const baseCode =
            buildIndicatorCodeBaseFromProcessus(trimmedProcessus, trimmedDesignation) ||
            `${toStorageIndicatorPrefix(extractProcessusCodePrefix(trimmedProcessus)) || 'proc'}`;
        const indicatorCode = await resolveUniqueIndicatorCode(pool, baseCode);

        const nextNordre = await getNextNordre(pool);

        await pool.request()
            .input('Nordre', sql.NVarChar(50), String(nextNordre))
            .input('indicateur', sql.NVarChar(255), indicatorCode)
            .input('processus', sql.NVarChar(255), trimmedProcessus)
            .input('designation', sql.NVarChar(500), trimmedDesignation)
            .input('signe', sql.NVarChar(20), signe || '')
            .input('unite', sql.NVarChar(50), unite || '')
            .query(`INSERT INTO dbo.Indicateur (Nordre, Indicateur, Processus, Designation, Signe, Unite)
                    VALUES (@Nordre, @indicateur, @processus, @designation, @signe, @unite)`);

        if (selectedYear) {
            await upsertIndicatorYear(pool, {
                idIndicateur: null,
                idProcessus: null,
                indicateur: indicatorCode,
                processus: trimmedProcessus,
                annee: selectedYear,
                signe,
                unite,
            });
        }

        if (trimmedResponsable) {
            await insertResponsable(pool, indicatorCode, trimmedResponsable, nextNordre);
            await upsertResponsableAssignment(pool, {
                processus: trimmedProcessus,
                indicateur: indicatorCode,
                responsableName: trimmedResponsable,
                updatedBy: req.user?.id ?? null,
            });
        }

        if (trimmedPilote) {
            await upsertPiloteAssignment(pool, {
                processus: trimmedProcessus,
                indicateur: indicatorCode,
                piloteName: trimmedPilote,
                updatedBy: req.user?.id ?? null,
            });
        }

        if (trimmedActionResponsable) {
            await upsertActionResponsableAssignment(pool, {
                processus: trimmedProcessus,
                indicateur: indicatorCode,
                actionResponsableName: trimmedActionResponsable,
                updatedBy: req.user?.id ?? null,
            });
        }

        res.status(201).json({
            message: 'Indicateur créé avec succès',
            indicateur: indicatorCode,
            processus: trimmedProcessus
        });
    } catch (error) {
        console.error('Error creating indicateur:', error);
        res.status(500).json({ error: 'Failed to create indicateur', details: error.message });
    }
});

// PUT /api/dashboard/indicateur/:indicateur/responsable - Upsert responsable assignment for one indicator
router.put('/indicateur/:indicateur/responsable', authMiddleware, async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
        }

        const { indicateur } = req.params;
        const responsableName = sanitizeNullableText(req.body?.responsable);

        await ensureIndicatorAssignmentsTable();

        const pool = await poolPromise;
        const indicatorIdentity = await fetchIndicatorIdentity(pool, indicateur);

        if (!indicatorIdentity) {
            return res.status(404).json({ error: 'Indicateur not found' });
        }

        await upsertResponsableAssignment(pool, {
            processus: indicatorIdentity.Processus,
            indicateur: indicatorIdentity.Indicateur,
            responsableName,
            updatedBy: req.user?.id ?? null,
        });

        res.json({
            message: 'Responsable assignment updated successfully',
            indicateur: indicatorIdentity.Indicateur,
            processus: indicatorIdentity.Processus,
            responsable: responsableName,
        });
    } catch (error) {
        console.error('Error updating responsable assignment:', error);
        res.status(500).json({ error: 'Failed to update responsable assignment', details: error.message });
    }
});

// PUT /api/dashboard/indicateur/:indicateur/pilote - Upsert pilote assignment for one indicator
router.put('/indicateur/:indicateur/pilote', authMiddleware, async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
        }

        const { indicateur } = req.params;
        const piloteName = sanitizeNullableText(req.body?.pilote);

        await ensureIndicatorAssignmentsTable();

        const pool = await poolPromise;
        const indicatorIdentity = await fetchIndicatorIdentity(pool, indicateur);

        if (!indicatorIdentity) {
            return res.status(404).json({ error: 'Indicateur not found' });
        }

        await upsertPiloteAssignment(pool, {
            processus: indicatorIdentity.Processus,
            indicateur: indicatorIdentity.Indicateur,
            piloteName,
            updatedBy: req.user?.id ?? null,
        });

        res.json({
            message: 'Pilote assignment updated successfully',
            indicateur: indicatorIdentity.Indicateur,
            processus: indicatorIdentity.Processus,
            pilote: piloteName,
        });
    } catch (error) {
        console.error('Error updating pilote assignment:', error);
        res.status(500).json({ error: 'Failed to update pilote assignment', details: error.message });
    }
});

// PUT /api/dashboard/indicateur/:indicateur/action-responsable - Upsert action responsable assignment for one indicator
router.put('/indicateur/:indicateur/action-responsable', authMiddleware, async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
        }

        const { indicateur } = req.params;
        const actionResponsableName = sanitizeNullableText(req.body?.responsable ?? req.body?.responsableAction);

        if (!actionResponsableName) {
            return res.status(400).json({ error: 'Action responsable name is required' });
        }

        const pool = await poolPromise;
        const indicatorIdentity = await fetchIndicatorIdentity(pool, indicateur);

        if (!indicatorIdentity) {
            return res.status(404).json({ error: 'Indicateur not found' });
        }

        const actionResponsableResult = await upsertActionResponsableAssignment(pool, {
            processus: indicatorIdentity.Processus,
            indicateur: indicatorIdentity.Indicateur,
            actionResponsableName,
            updatedBy: req.user?.id ?? null,
        });

        res.json({
            message: 'Action responsable updated successfully',
            indicateur: indicatorIdentity.Indicateur,
            processus: indicatorIdentity.Processus,
            responsable: actionResponsableResult.responsableAction,
            responsableAction: actionResponsableResult.responsableAction,
        });
    } catch (error) {
        console.error('Error updating action responsable assignment:', error);
        res.status(error.statusCode || 500).json({ error: 'Failed to update action responsable assignment', details: error.message });
    }
});

// PUT /api/dashboard/indicateur/:indicateur/user - Upsert user assignment for one indicator
router.put('/indicateur/:indicateur/user', authMiddleware, async (req, res) => {
    try {
        if (!isAdminRequest(req)) {
            return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
        }

        const { indicateur } = req.params;
        const parsedUserId = parseOptionalUserId(req.body?.userId);
        if (Number.isNaN(parsedUserId)) {
            return res.status(400).json({ error: 'Invalid userId' });
        }

        await ensureIndicatorAssignmentsTable();

        const pool = await poolPromise;
        const indicatorIdentity = await fetchIndicatorIdentity(pool, indicateur);

        if (!indicatorIdentity) {
            return res.status(404).json({ error: 'Indicateur not found' });
        }

        if (parsedUserId !== null) {
            const userExists = await ensureUserExists(pool, parsedUserId);
            if (!userExists) {
                return res.status(404).json({ error: 'User not found' });
            }
        }

        const previousUserId = await fetchAssignedUserId(
            pool,
            indicatorIdentity.Processus,
            indicatorIdentity.Indicateur
        );

        await upsertUserAssignment(pool, {
            processus: indicatorIdentity.Processus,
            indicateur: indicatorIdentity.Indicateur,
            userId: parsedUserId,
            updatedBy: req.user?.id ?? null,
        });

        await syncUserPermissionForAssignment(pool, {
            previousUserId,
            nextUserId: parsedUserId,
            processus: indicatorIdentity.Processus,
            indicateur: indicatorIdentity.Indicateur,
        });

        res.json({
            message: 'User assignment updated successfully',
            indicateur: indicatorIdentity.Indicateur,
            processus: indicatorIdentity.Processus,
            userId: parsedUserId,
            permissionSynced: true,
        });
    } catch (error) {
        console.error('Error updating user assignment:', error);
        res.status(500).json({ error: 'Failed to update user assignment', details: error.message });
    }
});

// PUT /api/dashboard/processus/:processus/responsable - Upsert responsable assignment for all indicators of a processus
router.put('/processus/:processus/responsable', authMiddleware, async (req, res) => {
    const trimmedProcessus = sanitizeNullableText(req.params.processus);
    const responsableName = sanitizeNullableText(req.body?.responsable);

    if (!isAdminRequest(req)) {
        return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
    }

    if (!trimmedProcessus) {
        return res.status(400).json({ error: 'Processus is required' });
    }

    await ensureIndicatorAssignmentsTable();

    const pool = await poolPromise;
    const indicators = await fetchIndicatorsByProcessus(pool, trimmedProcessus);
    if (!indicators.length) {
        return res.status(404).json({ error: 'No indicators found for this processus' });
    }

    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        for (const row of indicators) {
            await upsertResponsableAssignment(tx, {
                processus: row.Processus,
                indicateur: row.Indicateur,
                responsableName,
                updatedBy: req.user?.id ?? null,
            });
        }

        await tx.commit();
    } catch (error) {
        await tx.rollback();
        throw error;
    }

    res.json({
        message: 'Responsable assignments updated successfully',
        processus: trimmedProcessus,
        responsable: responsableName,
        updatedCount: indicators.length,
    });
});

// PUT /api/dashboard/processus/:processus/pilote - Upsert pilote assignment for all indicators of a processus
router.put('/processus/:processus/pilote', authMiddleware, async (req, res) => {
    const trimmedProcessus = sanitizeNullableText(req.params.processus);
    const piloteName = sanitizeNullableText(req.body?.pilote);

    if (!isAdminRequest(req)) {
        return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
    }

    if (!trimmedProcessus) {
        return res.status(400).json({ error: 'Processus is required' });
    }

    await ensureIndicatorAssignmentsTable();

    const pool = await poolPromise;
    const indicators = await fetchIndicatorsByProcessus(pool, trimmedProcessus);
    if (!indicators.length) {
        return res.status(404).json({ error: 'No indicators found for this processus' });
    }

    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        for (const row of indicators) {
            await upsertPiloteAssignment(tx, {
                processus: row.Processus,
                indicateur: row.Indicateur,
                piloteName,
                updatedBy: req.user?.id ?? null,
            });
        }

        await tx.commit();
    } catch (error) {
        await tx.rollback();
        throw error;
    }

    res.json({
        message: 'Pilote assignments updated successfully',
        processus: trimmedProcessus,
        pilote: piloteName,
        updatedCount: indicators.length,
    });
});

// PUT /api/dashboard/processus/:processus/user - Upsert user assignment for all indicators of a processus
router.put('/processus/:processus/user', authMiddleware, async (req, res) => {
    const trimmedProcessus = sanitizeNullableText(req.params.processus);
    const parsedUserId = parseOptionalUserId(req.body?.userId);

    if (!isAdminRequest(req)) {
        return res.status(403).json({ error: 'Access denied: only administrators can update assignments' });
    }

    if (!trimmedProcessus) {
        return res.status(400).json({ error: 'Processus is required' });
    }

    if (Number.isNaN(parsedUserId)) {
        return res.status(400).json({ error: 'Invalid userId' });
    }

    await ensureIndicatorAssignmentsTable();

    const pool = await poolPromise;
    const indicators = await fetchIndicatorsByProcessus(pool, trimmedProcessus);
    if (!indicators.length) {
        return res.status(404).json({ error: 'No indicators found for this processus' });
    }

    if (parsedUserId !== null) {
        const userExists = await ensureUserExists(pool, parsedUserId);
        if (!userExists) {
            return res.status(404).json({ error: 'User not found' });
        }
    }

    const currentAssignmentsResult = await pool.request()
        .input('processus', sql.NVarChar(255), trimmedProcessus)
        .query(`
            SELECT
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS Indicateur,
                user_id AS userId
            FROM dbo.indicator_assignments
            WHERE
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                AND user_id IS NOT NULL
        `);

    const previousUserByIndicator = new Map(
        currentAssignmentsResult.recordset
            .filter((row) => row.Indicateur)
            .map((row) => [row.Indicateur, row.userId])
    );

    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();

        if (parsedUserId === null) {
            await tx.request()
                .input('processus', sql.NVarChar(255), trimmedProcessus)
                .input('updatedBy', sql.Int, req.user?.id ?? null)
                .query(`
                    UPDATE dbo.indicator_assignments
                    SET user_id = NULL,
                        updated_at = GETDATE(),
                        updated_by = @updatedBy
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                `);

            for (const row of indicators) {
                await syncUserPermissionForAssignment(tx, {
                    previousUserId: previousUserByIndicator.get(row.Indicateur) ?? null,
                    nextUserId: null,
                    processus: row.Processus,
                    indicateur: row.Indicateur,
                });
            }
        } else {
            for (const row of indicators) {
                await upsertUserAssignment(tx, {
                    processus: row.Processus,
                    indicateur: row.Indicateur,
                    userId: parsedUserId,
                    updatedBy: req.user?.id ?? null,
                });

                await syncUserPermissionForAssignment(tx, {
                    previousUserId: previousUserByIndicator.get(row.Indicateur) ?? null,
                    nextUserId: parsedUserId,
                    processus: row.Processus,
                    indicateur: row.Indicateur,
                });
            }
        }

        await cleanupEmptyAssignmentsForProcessus(tx, trimmedProcessus);
        await tx.commit();
    } catch (error) {
        await tx.rollback();
        throw error;
    }

    res.json({
        message: 'User assignments updated successfully',
        processus: trimmedProcessus,
        userId: parsedUserId,
        permissionSynced: true,
        updatedCount: indicators.length,
    });
});

// PUT /api/dashboard/indicateur/:indicateur/description-year - Upsert year-specific description
router.put('/indicateur/:indicateur/description-year', authMiddleware, async (req, res) => {
    try {
        const indicateurParam = sanitizeNullableText(req.params.indicateur);
        const parsedYear = Number.parseInt(req.body?.year, 10);
        const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, 'description');
        const nextDescription = hasDescription ? String(req.body?.description ?? '') : '';

        if (!indicateurParam) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }
        if (!Number.isInteger(parsedYear)) {
            return res.status(400).json({ error: 'Year is required' });
        }

        await ensureIndicatorDescriptionsYearTable();
        const pool = await poolPromise;
        const indicatorIdentity = await fetchIndicatorIdentity(pool, indicateurParam);

        if (!indicatorIdentity) {
            return res.status(404).json({ error: 'Indicateur not found' });
        }

        if (!req.user?.isAdmin) {
            const perms = await UserPermission.getByUserId(req.user.id);
            const hasPermission = perms.some((p) =>
                sanitizeNullableText(p.indicateur) === indicatorIdentity.Indicateur &&
                sanitizeNullableText(p.processus) === indicatorIdentity.Processus
            );

            let isResponsable = false;
            if (!hasPermission) {
                const username = sanitizeNullableText(req.user.username);
                if (username) {
                    const responsableResult = await pool.request()
                        .input('username', sql.NVarChar(255), username)
                        .input('indicateur', sql.NVarChar(255), indicatorIdentity.Indicateur)
                        .query(`
                            SELECT COUNT(*) AS count FROM dbo.responsable
                            WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
                            AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '') = @username
                        `);
                    isResponsable = responsableResult.recordset[0].count > 0;
                }
            }

            if (!hasPermission && !isResponsable) {
                return res.status(403).json({
                    error: 'Access denied: you do not have permission to modify description for this indicator'
                });
            }
        }

        await pool.request()
            .input('indicateur', sql.NVarChar(255), indicatorIdentity.Indicateur)
            .input('year', sql.Int, parsedYear)
            .input('description', sql.NVarChar(sql.MAX), nextDescription)
            .input('updatedBy', sql.Int, req.user?.id ?? null)
            .query(`
                MERGE dbo.indicator_descriptions_year AS target
                USING (SELECT @indicateur AS indicateur, @year AS [year]) AS source
                ON
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.indicateur, CHAR(13), ''), CHAR(10), ''))), '') =
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(source.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                    AND target.[year] = source.[year]
                WHEN MATCHED THEN
                    UPDATE SET
                        target.description = @description,
                        target.updated_at = GETDATE(),
                        target.updated_by = @updatedBy
                WHEN NOT MATCHED THEN
                    INSERT (indicateur, [year], description, created_at, updated_at, updated_by)
                    VALUES (@indicateur, @year, @description, GETDATE(), GETDATE(), @updatedBy);
            `);

        res.json({
            message: 'Year description updated successfully',
            indicateur: indicatorIdentity.Indicateur,
            year: parsedYear,
            description: nextDescription
        });
    } catch (error) {
        console.error('Error updating year description:', error);
        res.status(500).json({ error: 'Failed to update year description', details: error.message });
    }
});

// PUT /api/dashboard/indicateur/:indicateur - Partial update (designation, sign, unit)
router.put('/indicateur/:indicateur', async (req, res) => {
    try {
        const { indicateur } = req.params;
        const { designation, description, signe, unite } = req.body || {};

        if (!indicateur || !indicateur.trim()) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }

        const pool = await poolPromise;

        const hasDesignation = Object.prototype.hasOwnProperty.call(req.body || {}, 'designation');
        const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, 'description');
        const hasSigne = Object.prototype.hasOwnProperty.call(req.body || {}, 'signe');
        const hasUnite = Object.prototype.hasOwnProperty.call(req.body || {}, 'unite');

        // Update only fields provided in request body.
        const result = await pool.request()
            .input('indicateur', sql.NVarChar(255), indicateur.trim())
            .input('designation', sql.NVarChar(500), hasDesignation ? (designation ?? '') : null)
            .input('description', sql.Text, hasDescription ? (description ?? '') : null)
            .input('signe', sql.NVarChar(10), hasSigne ? (signe ?? '') : null)
            .input('unite', sql.NVarChar(50), hasUnite ? (unite ?? '') : null)
            .query(`
                UPDATE dbo.Indicateur 
                SET
                    Designation = CASE WHEN @designation IS NULL THEN Designation ELSE @designation END,
                    Description = CASE WHEN @description IS NULL THEN Description ELSE @description END,
                    Signe = CASE WHEN @signe IS NULL THEN Signe ELSE @signe END,
                    Unite = CASE WHEN @unite IS NULL THEN Unite ELSE @unite END
                WHERE NULLIF(
                    LTRIM(RTRIM(REPLACE(REPLACE(Indicateur, CHAR(13), ''), CHAR(10), ''))),
                    ''
                ) = @indicateur;
                SELECT * FROM dbo.Indicateur 
                WHERE NULLIF(
                    LTRIM(RTRIM(REPLACE(REPLACE(Indicateur, CHAR(13), ''), CHAR(10), ''))),
                    ''
                ) = @indicateur
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Indicateur not found' });
        }

        res.json({
            message: 'Indicateur updated successfully',
            indicateur: indicateur.trim()
        });
    } catch (error) {
        console.error('Error updating indicateur:', error);
        res.status(500).json({ error: 'Failed to update indicateur', details: error.message });
    }
});

// PUT /api/dashboard/realise/:indicateur - Update realise month values
router.put('/realise/:indicateur', authMiddleware, async (req, res) => {
    try {
        const { indicateur } = req.params;
        const { year, month, value } = req.body;

        if (!indicateur || !indicateur.trim()) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }
        if (!year || !month) {
            return res.status(400).json({ error: 'Year and month are required' });
        }

        const validMonths = ['janv', 'fev', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'decem'];
        if (!validMonths.includes(month)) {
            return res.status(400).json({ error: 'Invalid month' });
        }

        // Permission check: Only admins or users assigned to this indicator can modify realise values
        if (!req.user.isAdmin) {
            // Check if user has permission for this indicator
            const pool = await poolPromise;
            const indicatorIdentity = await fetchIndicatorIdentity(pool, indicateur);

            if (!indicatorIdentity) {
                return res.status(404).json({ error: 'Indicateur not found' });
            }

            // Check user permissions
            const perms = await UserPermission.getByUserId(req.user.id);
            const hasPermission = perms.some(p =>
                sanitizeNullableText(p.indicateur) === indicatorIdentity.Indicateur &&
                sanitizeNullableText(p.processus) === indicatorIdentity.Processus
            );

            // Check responsable assignments
            let isResponsable = false;
            if (!hasPermission) {
                const username = sanitizeNullableText(req.user.username);
                if (username) {
                    const responsableResult = await pool.request()
                        .input('username', sql.NVarChar(255), username)
                        .input('indicateur', sql.NVarChar(255), indicatorIdentity.Indicateur)
                        .query(`
                            SELECT COUNT(*) AS count FROM dbo.responsable
                            WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
                            AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '') = @username
                        `);
                    isResponsable = responsableResult.recordset[0].count > 0;
                }
            }

            if (!hasPermission && !isResponsable) {
                return res.status(403).json({ error: 'Access denied: you do not have permission to modify realise values for this indicator' });
            }
        }

        const numericValue = (value !== null && value !== undefined && value !== '') ? Number(value) : null;

        const pool = await poolPromise;

        // Check if realise record exists for this year
        const checkResult = await pool.request()
            .input('indicateur', sql.NVarChar(255), indicateur.trim())
            .input('year', sql.Int, Number(year))
            .query(`
                SELECT TOP 1 indicateur FROM dbo.realise
                WHERE indicateur = @indicateur
                AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                ORDER BY COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow)) DESC,
                         TRY_CONVERT(datetime, datenow) DESC
            `);

        const utilis = req.user?.username || req.user?.name || req.user?.email || 'app';

        if (checkResult.recordset.length === 0) {
            // Insert new record for this year
            await pool.request()
                .input('indicateur', sql.NVarChar(255), indicateur.trim())
                .input('date1', sql.Date, new Date(`${year}-01-01`))
                .input('datenow', sql.DateTime, new Date())
                .input('utilis', sql.NVarChar(100), utilis)
                .query(`
                    INSERT INTO dbo.realise
                        (indicateur, janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem, date1, utilis, datenow, annuel)
                    VALUES
                        (@indicateur, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @date1, @utilis, @datenow, NULL)
                `);
        }

        // Now update the specific month column
        if (numericValue !== null) {
            await pool.request()
                .input('indicateur', sql.NVarChar(255), indicateur.trim())
                .input('year', sql.Int, Number(year))
                .input('value', sql.Decimal(18, 4), numericValue)
                .query(`
                    UPDATE dbo.realise
                    SET ${month} = @value
                    WHERE indicateur = @indicateur
                    AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                `);
        } else {
            await pool.request()
                .input('indicateur', sql.NVarChar(255), indicateur.trim())
                .input('year', sql.Int, Number(year))
                .query(`
                    UPDATE dbo.realise
                    SET ${month} = NULL
                    WHERE indicateur = @indicateur
                    AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                `);
        }

        res.json({ message: 'Realise updated successfully', indicateur: indicateur.trim(), year, month, value: numericValue });
    } catch (error) {
        console.error('Error updating realise:', error);
        res.status(500).json({ error: 'Failed to update realise', details: error.message });
    }
});

// PUT /api/dashboard/objective/:indicateur - Update objective values
// Accessible by admins AND responsables (users with permission for the indicator)
router.put('/objective/:indicateur', authMiddleware, async (req, res) => {
    const indicateurParam = req.params.indicateur;
    const { year, month, value, date_limite } = req.body;

    console.log(`[OBJECTIVE UPDATE] Request received - indicateur: ${indicateurParam}, year: ${year}, month: ${month}, value: ${value}`);
    console.log(`[OBJECTIVE UPDATE] User: ${req.user?.username}, isAdmin: ${req.user?.isAdmin}`);

    try {
        if (!indicateurParam || !indicateurParam.trim()) {
            return res.status(400).json({ error: 'Indicateur is required' });
        }
        if (!year || !month || value === undefined) {
            return res.status(400).json({ error: 'Year, month, and value are required' });
        }

        // Validate month to prevent SQL injection
        const validMonths = ['janv', 'fev', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'decem'];
        if (!validMonths.includes(month)) {
            return res.status(400).json({ error: 'Invalid month value' });
        }

        // Permission check: ONLY admins can modify objectives
        // All other users are in viewer mode
        if (!req.user.isAdmin) {
            console.log(`[OBJECTIVE UPDATE] User is not admin - access denied`);
            return res.status(403).json({ error: 'Access denied: only administrators can modify objectives' });
        }

        const pool = await poolPromise;
        const utilis = req.user?.username || req.user?.name || req.user?.email || 'app';
        const numericValue = (value !== null && value !== undefined && value !== '') ? Number(value) : null;

        console.log(`[OBJECTIVE UPDATE] Checking for existing objective record...`);

        // Check if objective record exists for this year
        const checkResult = await pool.request()
            .input('indicateur', sql.NVarChar(255), indicateurParam.trim())
            .input('year', sql.Int, Number(year))
            .query(`
                SELECT TOP 1 id FROM dbo.objectiv
                WHERE LTRIM(RTRIM(indicateur)) = LTRIM(RTRIM(@indicateur))
                AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                ORDER BY COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow)) DESC,
                         TRY_CONVERT(datetime, datenow) DESC
            `);

        console.log(`[OBJECTIVE UPDATE] Existing records found: ${checkResult.recordset.length}`);

        if (checkResult.recordset.length === 0) {
            // Create new objective record for this year
            console.log(`[OBJECTIVE UPDATE] Creating new objective record for year ${year}...`);
            try {
                // First try without explicit ID (if identity column allows auto-insert)
                await pool.request()
                    .input('indicateur', sql.NVarChar(255), indicateurParam.trim())
                    .input('date1', sql.Date, new Date(`${year}-01-01`))
                    .input('utilis', sql.NVarChar(100), utilis)
                    .query(`
                        INSERT INTO dbo.objectiv
                            (indicateur, janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem, date1, utilis, datenow)
                        VALUES
                            (@indicateur, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @date1, @utilis, GETDATE())
                    `);
                console.log(`[OBJECTIVE UPDATE] New record created successfully (auto-id)`);
            } catch (insertErr) {
                console.log(`[OBJECTIVE UPDATE] First insert attempt failed:`, insertErr.message);
                // If insert failed due to identity column requiring explicit id, fall back to MAX(id)+1
                if (insertErr.message && insertErr.message.toLowerCase().includes('identity')) {
                    const maxResult = await pool.request().query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM dbo.objectiv');
                    const nextId = maxResult.recordset[0].nextId;
                    console.log(`[OBJECTIVE UPDATE] Trying with explicit ID: ${nextId}`);

                    await pool.request()
                        .input('id', sql.Int, nextId)
                        .input('indicateur', sql.NVarChar(255), indicateurParam.trim())
                        .input('date1', sql.Date, new Date(`${year}-01-01`))
                        .input('utilis', sql.NVarChar(100), utilis)
                        .query(`
                            SET IDENTITY_INSERT dbo.objectiv ON;
                            INSERT INTO dbo.objectiv
                                (id, indicateur, janv, fev, mars, avril, mai, juin, juil, aout, sept, oct, nov, decem, date1, utilis, datenow)
                            VALUES
                                (@id, @indicateur, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @date1, @utilis, GETDATE());
                            SET IDENTITY_INSERT dbo.objectiv OFF;
                        `);
                    console.log(`[OBJECTIVE UPDATE] New record created successfully (explicit ID)`);
                } else {
                    console.error(`[OBJECTIVE UPDATE] Insert failed with unexpected error:`, insertErr);
                    throw insertErr;
                }
            }
        }

        // Now update the specific month
        console.log(`[OBJECTIVE UPDATE] Updating month ${month} with value ${numericValue}...`);

        // Parse date_limite if provided
        let dateLimiteValue = null;
        if (date_limite) {
            try {
                dateLimiteValue = new Date(date_limite);
                if (isNaN(dateLimiteValue.getTime())) {
                    dateLimiteValue = null;
                }
            } catch (e) {
                dateLimiteValue = null;
            }
        }

        if (numericValue !== null || dateLimiteValue) {
            const request = pool.request()
                .input('indicateur', sql.NVarChar(255), indicateurParam.trim())
                .input('year', sql.Int, Number(year))
                .input('value', sql.Decimal(18, 4), numericValue)
                .input('utilis', sql.NVarChar(100), utilis);

            let query = '';
            if (dateLimiteValue) {
                request.input('date_limite', sql.Date, dateLimiteValue);
                query = `
                    UPDATE dbo.objectiv
                    SET ${month} = @value, utilis = @utilis, datenow = GETDATE(), date_limite = @date_limite
                    WHERE LTRIM(RTRIM(indicateur)) = LTRIM(RTRIM(@indicateur))
                    AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                `;
            } else {
                query = `
                    UPDATE dbo.objectiv
                    SET ${month} = @value, utilis = @utilis, datenow = GETDATE()
                    WHERE LTRIM(RTRIM(indicateur)) = LTRIM(RTRIM(@indicateur))
                    AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                `;
            }

            const updateResult = await request.query(query);
            console.log(`[OBJECTIVE UPDATE] Update result: ${updateResult.rowsAffected[0]} row(s) affected`);
        } else if (numericValue === null) {
            const updateResult = await pool.request()
                .input('indicateur', sql.NVarChar(255), indicateurParam.trim())
                .input('year', sql.Int, Number(year))
                .input('utilis', sql.NVarChar(100), utilis)
                .query(`
                    UPDATE dbo.objectiv
                    SET ${month} = NULL, utilis = @utilis, datenow = GETDATE()
                    WHERE LTRIM(RTRIM(indicateur)) = LTRIM(RTRIM(@indicateur))
                    AND YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) = @year
                `);
            console.log(`[OBJECTIVE UPDATE] Update result (null): ${updateResult.rowsAffected[0]} row(s) affected`);
        }

        console.log(`[OBJECTIVE UPDATE] SUCCESS!`);

        res.json({
            message: 'Objective updated successfully',
            indicateur: indicateurParam.trim(),
            year,
            month,
            value,
            updatedBy: utilis
        });
    } catch (error) {
        console.error('[OBJECTIVE UPDATE] Error updating objective:', error);
        res.status(500).json({ error: 'Failed to update objective', details: error.message });
    }
});

// GET /api/dashboard/periods - Get available periods for an indicator
router.get('/periods/:indicateur', async (req, res) => {
    try {
        const { indicateur } = req.params;
        const pool = await poolPromise;

        // Get all unique years from objectives
        const objectivesResult = await pool.request()
            .input('indicateur', sql.NVarChar(255), indicateur)
            .query(`
                SELECT DISTINCT 
                    YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) as year
                FROM dbo.objectiv
                WHERE indicateur = @indicateur
                ORDER BY year DESC
            `);

        // Get all unique years from realises
        const realisesResult = await pool.request()
            .input('indicateur', sql.NVarChar(255), indicateur)
            .query(`
                SELECT DISTINCT 
                    YEAR(COALESCE(TRY_CONVERT(date, date1), TRY_CONVERT(date, datenow))) as year
                FROM dbo.realise
                WHERE indicateur = @indicateur
                ORDER BY year DESC
            `);

        // Combine and deduplicate years
        const allYears = [...new Set([
            ...objectivesResult.recordset.map(r => r.year),
            ...realisesResult.recordset.map(r => r.year)
        ])].filter(Boolean).sort((a, b) => b - a);

        res.json({
            years: allYears
        });
    } catch (error) {
        console.error('Error fetching periods:', error);
        res.status(500).json({ error: 'Failed to fetch periods', details: error.message });
    }
});



// GET /api/dashboard/users - Get all users (for admin dropdowns)
router.get('/users', authMiddleware, async (req, res) => {
    try {
        // Only admins can see the users list
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: only administrators can view users' });
        }

        const processusFilter = sanitizeNullableText(req.query.processus);
        const pool = await poolPromise;
        const hasUserTypeColumn = await hasUsersUserTypeColumn(pool);
        const request = pool.request();
        request.input('processus', sql.NVarChar(255), processusFilter);
        request.input('hasProcessFilter', sql.Bit, processusFilter ? 1 : 0);

        const query = hasUserTypeColumn
            ? `
            WITH users_with_counts AS (
                SELECT
                    u.id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(u.username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    CAST(COALESCE(u.isAdmin, 0) AS BIT) AS isAdmin,
                    COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(u.user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user') AS userType,
                    COUNT(
                        DISTINCT CASE
                            WHEN @hasProcessFilter = 0 THEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                            WHEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                            THEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                            ELSE NULL
                        END
                    ) AS processIndicatorCount
                FROM dbo.users AS u
                LEFT JOIN dbo.user_permissions AS up ON up.user_id = u.id
                GROUP BY u.id, u.username, u.isAdmin, u.user_type
            ),
            responsables_only AS (
                SELECT DISTINCT
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS username
                FROM dbo.responsable AS r
                WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.responsable, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
            ),
            users_union AS (
                SELECT
                    uwc.id,
                    uwc.username,
                    uwc.isAdmin,
                    uwc.userType,
                    CAST(uwc.processIndicatorCount AS INT) AS processIndicatorCount,
                    CAST('users' AS NVARCHAR(20)) AS source
                FROM users_with_counts AS uwc
                WHERE uwc.username IS NOT NULL
                UNION ALL
                SELECT
                    CAST(NULL AS INT) AS id,
                    ro.username,
                    CAST(0 AS BIT) AS isAdmin,
                    CAST('responsable' AS NVARCHAR(50)) AS userType,
                    CAST(0 AS INT) AS processIndicatorCount,
                    CAST('responsable' AS NVARCHAR(20)) AS source
                FROM responsables_only AS ro
                LEFT JOIN users_with_counts AS uwc
                    ON uwc.username = ro.username
                WHERE
                    ro.username IS NOT NULL
                    AND uwc.id IS NULL
            )
            SELECT
                id,
                username,
                isAdmin,
                userType,
                processIndicatorCount,
                source
            FROM users_union
            ORDER BY username
        `
            : `
            WITH users_with_counts AS (
                SELECT
                    u.id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(u.username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    CAST(COALESCE(u.isAdmin, 0) AS BIT) AS isAdmin,
                    CAST('user' AS NVARCHAR(50)) AS userType,
                    COUNT(
                        DISTINCT CASE
                            WHEN @hasProcessFilter = 0 THEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                            WHEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') = @processus
                            THEN NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                            ELSE NULL
                        END
                    ) AS processIndicatorCount
                FROM dbo.users AS u
                LEFT JOIN dbo.user_permissions AS up ON up.user_id = u.id
                GROUP BY u.id, u.username, u.isAdmin
            ),
            responsables_only AS (
                SELECT DISTINCT
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS username
                FROM dbo.responsable AS r
                WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.responsable, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
            ),
            users_union AS (
                SELECT
                    uwc.id,
                    uwc.username,
                    uwc.isAdmin,
                    uwc.userType,
                    CAST(uwc.processIndicatorCount AS INT) AS processIndicatorCount,
                    CAST('users' AS NVARCHAR(20)) AS source
                FROM users_with_counts AS uwc
                WHERE uwc.username IS NOT NULL
                UNION ALL
                SELECT
                    CAST(NULL AS INT) AS id,
                    ro.username,
                    CAST(0 AS BIT) AS isAdmin,
                    CAST('responsable' AS NVARCHAR(50)) AS userType,
                    CAST(0 AS INT) AS processIndicatorCount,
                    CAST('responsable' AS NVARCHAR(20)) AS source
                FROM responsables_only AS ro
                LEFT JOIN users_with_counts AS uwc
                    ON uwc.username = ro.username
                WHERE
                    ro.username IS NOT NULL
                    AND uwc.id IS NULL
            )
            SELECT
                id,
                username,
                isAdmin,
                userType,
                processIndicatorCount,
                source
            FROM users_union
            ORDER BY username
        `;

        const result = await request.query(query);

        return res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});

// GET /api/dashboard/pilotes - Get pilote candidates from dbo.responsable (same source as responsables)
router.get('/pilotes', authMiddleware, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: only administrators can view pilotes' });
        }

        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT DISTINCT
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '') AS pilote
            FROM dbo.responsable
            WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
            ORDER BY pilote
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching pilotes:', error);
        res.status(500).json({ error: 'Failed to fetch pilotes', details: error.message });
    }
});

// GET /api/dashboard/responsables - Get all responsables (for authenticated dropdowns)
router.get('/responsables', authMiddleware, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT DISTINCT
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '') AS responsable
            FROM dbo.responsable
            WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
            ORDER BY responsable
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching responsables:', error);
        res.status(500).json({ error: 'Failed to fetch responsables', details: error.message });
    }
});

// GET /api/dashboard/action-responsables - Get action responsables from dbo.responsable.responsable_action
router.get('/action-responsables', authMiddleware, async (req, res) => {
    try {
        const trimmedIndicator = sanitizeNullableText(req.query?.indicateur);

        // Get user type
        const pool0 = await poolPromise;
        const userResult = await pool0.request()
            .input('user_id', sql.Int, req.user.id)
            .query(`SELECT COALESCE(NULLIF(LTRIM(RTRIM(user_type)), ''), 'user') AS user_type FROM users WHERE id = @user_id`);
        const userType = userResult.recordset[0]?.user_type || 'user';

        // Admins can access all, responsables/pilotes can access with or without indicator
        const isAuthorized = req.user?.isAdmin || userType === 'responsable' || userType === 'pilote';

        if (!trimmedIndicator && !isAuthorized) {
            return res.status(403).json({ error: 'Access denied: indicateur is required for non-admin users' });
        }

        if (trimmedIndicator && !req.user?.isAdmin && userType !== 'responsable' && userType !== 'pilote') {
            const userPermissions = await UserPermission.getByUserId(req.user.id);
            const canAccessIndicator = userPermissions.some(
                (permission) => sanitizeNullableText(permission?.indicateur) === trimmedIndicator
            );

            if (!canAccessIndicator) {
                return res.status(403).json({ error: 'Access denied: insufficient permissions' });
            }
        }

        await ensureResponsableActionColumn();
        const pool = await poolPromise;
        let result = { recordset: [] };

        if (trimmedIndicator) {
            result = await pool.request()
                .input('indicateur', sql.NVarChar(255), trimmedIndicator)
                .query(`
                    SELECT DISTINCT
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable_action, CHAR(13), ''), CHAR(10), ''))), '') AS responsable
                    FROM dbo.responsable
                    WHERE
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(indicateur, CHAR(13), ''), CHAR(10), ''))), '') = @indicateur
                        AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable_action, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
                    ORDER BY responsable
                `);
        }

        if (!trimmedIndicator || result.recordset.length === 0) {
            result = await pool.request().query(`
                SELECT DISTINCT
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable_action, CHAR(13), ''), CHAR(10), ''))), '') AS responsable
                FROM dbo.responsable
                WHERE NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(responsable_action, CHAR(13), ''), CHAR(10), ''))), '') IS NOT NULL
                ORDER BY responsable
            `);
        }

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching action responsables:', error);
        res.status(500).json({ error: 'Failed to fetch action responsables', details: error.message });
    }
});

// GET /api/dashboard/users/pilotes - Get all users with user_type = 'pilote' from users table
router.get('/users/pilotes', authMiddleware, async (req, res) => {
    try {
        // Only admins can see the pilotes list
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: only administrators can view pilotes' });
        }

        const pool = await poolPromise;
        const hasUserTypeColumn = await hasUsersUserTypeColumn(pool);

        let query;
        if (hasUserTypeColumn) {
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user') AS userType
                FROM dbo.users
                WHERE LOWER(COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user')) = 'pilote'
                ORDER BY username
            `;
        } else {
            // If user_type column doesn't exist, return empty array
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    CAST('user' AS NVARCHAR(50)) AS userType
                FROM dbo.users
                WHERE 1 = 0
            `;
        }

        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching pilotes from users table:', error);
        res.status(500).json({ error: 'Failed to fetch pilotes', details: error.message });
    }
});

// GET /api/dashboard/users/responsables - Get all users with user_type = 'responsable' from users table
router.get('/users/responsables', authMiddleware, async (req, res) => {
    try {
        // Only admins can see the responsables list
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: only administrators can view responsables' });
        }

        const pool = await poolPromise;
        const hasUserTypeColumn = await hasUsersUserTypeColumn(pool);

        let query;
        if (hasUserTypeColumn) {
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user') AS userType
                FROM dbo.users
                WHERE LOWER(COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user')) = 'responsable'
                ORDER BY username
            `;
        } else {
            // If user_type column doesn't exist, return empty array
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    CAST('user' AS NVARCHAR(50)) AS userType
                FROM dbo.users
                WHERE 1 = 0
            `;
        }

        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching responsables from users table:', error);
        res.status(500).json({ error: 'Failed to fetch responsables', details: error.message });
    }
});

// GET /api/dashboard/users/regular - Get all users with user_type = 'user' from users table
router.get('/users/regular', authMiddleware, async (req, res) => {
    try {
        // Only admins can see the regular users list
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: only administrators can view regular users' });
        }

        const pool = await poolPromise;
        const hasUserTypeColumn = await hasUsersUserTypeColumn(pool);

        let query;
        if (hasUserTypeColumn) {
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user') AS userType
                FROM dbo.users
                WHERE LOWER(COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user')) = 'user'
                ORDER BY username
            `;
        } else {
            // If user_type column doesn't exist, return all users as 'user'
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    CAST('user' AS NVARCHAR(50)) AS userType
                FROM dbo.users
                ORDER BY username
            `;
        }

        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching regular users from users table:', error);
        res.status(500).json({ error: 'Failed to fetch regular users', details: error.message });
    }
});

// GET /api/dashboard/users/by-type/:userType - Get users by specific user_type from users table
router.get('/users/by-type/:userType', authMiddleware, async (req, res) => {
    try {
        // Only admins can see the users list by type
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied: only administrators can view users' });
        }

        const { userType } = req.params;
        const normalizedUserType = String(userType ?? '').trim().toLowerCase();

        // Validate userType
        const validTypes = ['user', 'responsable', 'pilote'];
        if (!validTypes.includes(normalizedUserType)) {
            return res.status(400).json({
                error: 'Invalid userType. Must be one of: user, responsable, pilote'
            });
        }

        const pool = await poolPromise;
        const hasUserTypeColumn = await hasUsersUserTypeColumn(pool);

        let query;
        if (hasUserTypeColumn) {
            query = `
                SELECT 
                    id,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                    COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user') AS userType
                FROM dbo.users
                WHERE LOWER(COALESCE(NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(user_type, CHAR(13), ''), CHAR(10), ''))), ''), 'user')) = @userType
                ORDER BY username
            `;
        } else {
            // If user_type column doesn't exist
            if (normalizedUserType === 'user') {
                query = `
                    SELECT 
                        id,
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                        CAST('user' AS NVARCHAR(50)) AS userType
                    FROM dbo.users
                    ORDER BY username
                `;
            } else {
                query = `
                    SELECT 
                        id,
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(username, CHAR(13), ''), CHAR(10), ''))), '') AS username,
                        CAST('user' AS NVARCHAR(50)) AS userType
                    FROM dbo.users
                    WHERE 1 = 0
                `;
            }
        }

        const request = pool.request();
        if (hasUserTypeColumn) {
            request.input('userType', sql.NVarChar(50), normalizedUserType);
        }

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching users by type:', error);
        res.status(500).json({ error: 'Failed to fetch users by type', details: error.message });
    }
});

module.exports = router;
