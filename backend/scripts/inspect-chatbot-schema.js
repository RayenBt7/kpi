const { poolPromise, sql } = require('../config/database');

const TABLES = [
    'Indicateur',
    'objectiv',
    'realise',
    'Plan_action',
    'ml_anomalies',
    'ml_risk_scores',
    'ml_suggestions',
    'users'
];

(async () => {
    const pool = await poolPromise;

    for (const table of TABLES) {
        const result = await pool.request()
            .input('tableName', sql.NVarChar(255), table)
            .query(`
                SELECT COLUMN_NAME, DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'dbo'
                    AND TABLE_NAME = @tableName
                ORDER BY ORDINAL_POSITION
            `);

        console.log(`TABLE ${table}`);
        console.log(result.recordset.map((column) => `${column.COLUMN_NAME}:${column.DATA_TYPE}`).join(', '));
    }

    process.exit(0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
