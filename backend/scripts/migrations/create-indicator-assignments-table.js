const { poolPromise } = require('../../config/database');

async function createIndicatorAssignmentsTable() {
    try {
        const pool = await poolPromise;

        await pool.request().query(`
            IF OBJECT_ID('dbo.indicator_assignments', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.indicator_assignments (
                    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    processus NVARCHAR(255) NOT NULL,
                    indicateur NVARCHAR(255) NOT NULL,
                    pilote_name NVARCHAR(255) NULL,
                    responsable_name NVARCHAR(255) NULL,
                    user_id INT NULL,
                    created_at DATETIME NOT NULL CONSTRAINT DF_indicator_assignments_created_at DEFAULT GETDATE(),
                    updated_at DATETIME NOT NULL CONSTRAINT DF_indicator_assignments_updated_at DEFAULT GETDATE(),
                    updated_by INT NULL
                );

                CREATE UNIQUE INDEX UX_indicator_assignments_processus_indicateur
                    ON dbo.indicator_assignments (processus, indicateur);

                CREATE INDEX IX_indicator_assignments_indicateur
                    ON dbo.indicator_assignments (indicateur);

                ALTER TABLE dbo.indicator_assignments
                    ADD CONSTRAINT FK_indicator_assignments_user
                    FOREIGN KEY (user_id) REFERENCES dbo.users(id);

                ALTER TABLE dbo.indicator_assignments
                    ADD CONSTRAINT FK_indicator_assignments_updated_by
                    FOREIGN KEY (updated_by) REFERENCES dbo.users(id);
            END

            IF COL_LENGTH('dbo.indicator_assignments', 'pilote_name') IS NULL
            BEGIN
                ALTER TABLE dbo.indicator_assignments
                    ADD pilote_name NVARCHAR(255) NULL;
            END

            IF COL_LENGTH('dbo.indicator_assignments', 'action_responsable_name') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.indicator_assignments
                    DROP COLUMN action_responsable_name;
            END
        `);

        await pool.request().query(`
            ;WITH responsable_ranked AS (
                SELECT
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS indicateur,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.responsable, CHAR(13), ''), CHAR(10), ''))), '') AS responsable_name,
                    ROW_NUMBER() OVER (
                        PARTITION BY NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(r.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                        ORDER BY
                            CASE WHEN TRY_CONVERT(INT, r.code_responsable) IS NULL THEN 1 ELSE 0 END,
                            TRY_CONVERT(INT, r.code_responsable),
                            r.code_responsable DESC
                    ) AS rn
                FROM dbo.responsable AS r
            ),
            source_responsables AS (
                SELECT
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Processus, CHAR(13), ''), CHAR(10), ''))), '') AS processus,
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS indicateur,
                    rr.responsable_name
                FROM dbo.Indicateur AS i
                INNER JOIN responsable_ranked AS rr
                    ON rr.rn = 1
                    AND rr.indicateur = NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(i.Indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                WHERE rr.responsable_name IS NOT NULL
            )
            MERGE dbo.indicator_assignments AS target
            USING source_responsables AS source
            ON
                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.processus, CHAR(13), ''), CHAR(10), ''))), '') = source.processus
                AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.indicateur, CHAR(13), ''), CHAR(10), ''))), '') = source.indicateur
            WHEN MATCHED
                 AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.responsable_name, CHAR(13), ''), CHAR(10), ''))), '') IS NULL
            THEN
                UPDATE SET
                    target.responsable_name = source.responsable_name,
                    target.updated_at = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (processus, indicateur, responsable_name, user_id, created_at, updated_at)
                VALUES (source.processus, source.indicateur, source.responsable_name, NULL, GETDATE(), GETDATE());
        `);

        await pool.request().query(`
            IF OBJECT_ID('dbo.user_permissions', 'U') IS NOT NULL
            BEGIN
                ;WITH perms_ranked AS (
                    SELECT
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), '') AS processus,
                        NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '') AS indicateur,
                        up.user_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY
                                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.processus, CHAR(13), ''), CHAR(10), ''))), ''),
                                NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(up.indicateur, CHAR(13), ''), CHAR(10), ''))), '')
                            ORDER BY up.created_at DESC, up.id DESC
                        ) AS rn
                    FROM dbo.user_permissions AS up
                    WHERE up.user_id IS NOT NULL
                ),
                source_users AS (
                    SELECT processus, indicateur, user_id
                    FROM perms_ranked
                    WHERE rn = 1
                        AND processus IS NOT NULL
                        AND indicateur IS NOT NULL
                )
                MERGE dbo.indicator_assignments AS target
                USING source_users AS source
                ON
                    NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.processus, CHAR(13), ''), CHAR(10), ''))), '') = source.processus
                    AND NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(target.indicateur, CHAR(13), ''), CHAR(10), ''))), '') = source.indicateur
                WHEN MATCHED THEN
                    UPDATE SET
                        target.user_id = source.user_id,
                        target.updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (processus, indicateur, responsable_name, user_id, created_at, updated_at)
                    VALUES (source.processus, source.indicateur, NULL, source.user_id, GETDATE(), GETDATE());
            END
        `);

        const countResult = await pool.request().query('SELECT COUNT(*) AS total FROM dbo.indicator_assignments');
        const total = countResult.recordset[0]?.total || 0;
        console.log(`indicator_assignments is ready. Rows: ${total}`);
    } catch (error) {
        console.error('Failed to create/migrate indicator_assignments:', error);
        process.exitCode = 1;
    }
}

createIndicatorAssignmentsTable();
