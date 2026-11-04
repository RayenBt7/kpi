const sql = require('mssql');
const { poolPromise } = require('../../config/database');

const addDateLimiteColumn = async () => {
    try {
        const pool = await poolPromise;
        
        console.log('Adding date_limite column to dbo.objectiv...');
        await pool.request().query(`
            IF COL_LENGTH('dbo.objectiv', 'date_limite') IS NULL
            BEGIN
                ALTER TABLE dbo.objectiv
                ADD date_limite DATE NULL;
                PRINT 'Column date_limite added to objectiv table';
            END
            ELSE
            BEGIN
                PRINT 'Column date_limite already exists in objectiv table';
            END
        `);

        console.log('Adding date_limite column to dbo.realise...');
        await pool.request().query(`
            IF COL_LENGTH('dbo.realise', 'date_limite') IS NULL
            BEGIN
                ALTER TABLE dbo.realise
                ADD date_limite DATE NULL;
                PRINT 'Column date_limite added to realise table';
            END
            ELSE
            BEGIN
                PRINT 'Column date_limite already exists in realise table';
            END
        `);

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error adding date_limite column:', error);
        process.exit(1);
    }
};

addDateLimiteColumn();

