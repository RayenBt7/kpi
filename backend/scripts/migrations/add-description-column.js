const sql = require('mssql');
const { poolPromise } = require('../../config/database');

const addDescriptionColumn = async () => {
    try {
        const pool = await poolPromise;
        
        // Check if Description column already exists
        const checkResult = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Indicateur' AND COLUMN_NAME = 'Description'
        `);

        if (checkResult.recordset.length > 0) {
            console.log('Column Description already exists in Indicateur table.');
            return;
        }

        // Add Description column
        await pool.request().query(`
            ALTER TABLE dbo.Indicateur
            ADD Description NVARCHAR(MAX) NULL
        `);

        console.log('Column Description added successfully to Indicateur table!');
    } catch (error) {
        console.error('Error adding Description column:', error);
        throw error;
    }
};

// Run if called directly
if (require.main === module) {
    addDescriptionColumn()
        .then(() => {
            console.log('Migration completed successfully!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

module.exports = addDescriptionColumn;
