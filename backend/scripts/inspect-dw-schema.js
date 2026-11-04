const { dwPoolPromise, sql } = require('../config/database');

(async () => {
    const pool = await dwPoolPromise;
    const result = await pool.request().query(`
        SELECT
            c.TABLE_SCHEMA,
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE,
            c.IS_NULLABLE,
            c.ORDINAL_POSITION,
            COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
        FROM INFORMATION_SCHEMA.COLUMNS AS c
        WHERE c.TABLE_SCHEMA = 'dbo'
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `);

    let currentTable = '';
    for (const column of result.recordset) {
        const tableName = `${column.TABLE_SCHEMA}.${column.TABLE_NAME}`;
        if (tableName !== currentTable) {
            currentTable = tableName;
            console.log(`\nTABLE ${tableName}`);
        }

        const length =
            column.CHARACTER_MAXIMUM_LENGTH === null || column.CHARACTER_MAXIMUM_LENGTH === undefined
                ? ''
                : `(${column.CHARACTER_MAXIMUM_LENGTH})`;
        const numeric =
            column.NUMERIC_PRECISION === null || column.NUMERIC_PRECISION === undefined
                ? ''
                : `(${column.NUMERIC_PRECISION},${column.NUMERIC_SCALE})`;
        const typeDetails = length || numeric;
        const identity = column.IS_IDENTITY ? ' identity' : '';

        console.log(` - ${column.COLUMN_NAME}: ${column.DATA_TYPE}${typeDetails}, nullable=${column.IS_NULLABLE}${identity}`);
    }

    await sql.close();
    process.exit(0);
})().catch(async (error) => {
    console.error(error);
    await sql.close();
    process.exit(1);
});
