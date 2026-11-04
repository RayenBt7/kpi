const sql = require('mssql');
const { poolPromise } = require('../config/database');

class Indicateur {
    // Get all indicateurs
    static async getAll() {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .query('SELECT * FROM dbo.Indicateur ORDER BY Nordre');
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting all indicateurs:', error);
            throw error;
        }
    }

    // Get indicateur by Nordre
    static async getById(nordre) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('Nordre', sql.Int, nordre)
                .query('SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre');
            
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error getting indicateur by ID:', error);
            throw error;
        }
    }

    // Get indicateurs filtered by user permissions
    static async getByPermissions(allowedProcessus, allowedIndicateurs) {
        try {
            const pool = await poolPromise;
            
            // Create parameterized query for security
            const processusParams = allowedProcessus.map((_, index) => `@processus${index}`).join(',');
            const indicateurParams = allowedIndicateurs.map((_, index) => `@indicateur${index}`).join(',');
            
            let query = `
                SELECT DISTINCT i.* 
                FROM dbo.Indicateur i
                WHERE (i.Processus IN (${processusParams}) OR i.Indicateur IN (${indicateurParams}))
                ORDER BY i.Nordre
            `;
            
            const request = pool.request();
            
            // Add processus parameters
            allowedProcessus.forEach((processus, index) => {
                request.input(`processus${index}`, sql.VarChar, processus);
            });
            
            // Add indicateur parameters
            allowedIndicateurs.forEach((indicateur, index) => {
                request.input(`indicateur${index}`, sql.VarChar, indicateur);
            });
            
            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error getting indicateurs by permissions:', error);
            throw error;
        }
    }

    // Create new indicateur
    static async create(data) {
        try {
            const { Indicateur, Processus, Designation, Description, Signe, Unite } = data;
            const pool = await poolPromise;
            
            // Get the next Nordre value
            const maxResult = await pool.request().query('SELECT MAX(Nordre) as maxNordre FROM dbo.Indicateur');
            const nextNordre = (maxResult.recordset[0].maxNordre || 0) + 1;

            const result = await pool.request()
                .input('Nordre', sql.Int, nextNordre)
                .input('Indicateur', sql.VarChar, Indicateur || '')
                .input('Processus', sql.VarChar, Processus || '')
                .input('Designation', sql.VarChar, Designation || '')
                .input('Description', sql.Text, Description || '')
                .input('Signe', sql.VarChar, Signe || '')
                .input('Unite', sql.VarChar, Unite || '')
                .query(`INSERT INTO dbo.Indicateur (Nordre, Indicateur, Processus, Designation, Description, Signe, Unite) 
                        VALUES (@Nordre, @Indicateur, @Processus, @Designation, @Description, @Signe, @Unite);
                        SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre`);
            
            return result.recordset[0];
        } catch (error) {
            console.error('Error creating indicateur:', error);
            throw error;
        }
    }

    // Update indicateur
    static async update(nordre, data) {
        try {
            const { Indicateur, Processus, Designation, Description, Signe, Unite } = data;
            const pool = await poolPromise;
            
            const result = await pool.request()
                .input('Nordre', sql.Int, nordre)
                .input('Indicateur', sql.VarChar, Indicateur || '')
                .input('Processus', sql.VarChar, Processus || '')
                .input('Designation', sql.VarChar, Designation || '')
                .input('Description', sql.Text, Description || '')
                .input('Signe', sql.VarChar, Signe || '')
                .input('Unite', sql.VarChar, Unite || '')
                .query(`UPDATE dbo.Indicateur 
                        SET Indicateur = @Indicateur, Processus = @Processus, Designation = @Designation, 
                            Description = @Description, Signe = @Signe, Unite = @Unite 
                        WHERE Nordre = @Nordre;
                        SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre`);
            
            return result.recordset[0];
        } catch (error) {
            console.error('Error updating indicateur:', error);
            throw error;
        }
    }

    // Delete indicateur
    static async delete(nordre) {
        try {
            const pool = await poolPromise;
            
            // Check if indicateur exists
            const checkResult = await pool.request()
                .input('Nordre', sql.Int, nordre)
                .query('SELECT * FROM dbo.Indicateur WHERE Nordre = @Nordre');
            
            if (checkResult.recordset.length === 0) {
                throw new Error('Indicateur not found');
            }

            await pool.request()
                .input('Nordre', sql.Int, nordre)
                .query('DELETE FROM dbo.Indicateur WHERE Nordre = @Nordre');
            
            return true;
        } catch (error) {
            console.error('Error deleting indicateur:', error);
            throw error;
        }
    }
}

module.exports = Indicateur;