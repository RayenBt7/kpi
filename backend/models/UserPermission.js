const sql = require('mssql');
const { poolPromise } = require('../config/database');

class UserPermission {
    // Get permissions for a specific user
    static async getByUserId(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT DISTINCT processus, indicateur 
                    FROM user_permissions 
                    WHERE user_id = @userId
                `);
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting user permissions:', error);
            throw error;
        }
    }

    // Get all unique processus from permissions
    static async getAllProcessus() {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .query('SELECT DISTINCT processus FROM user_permissions ORDER BY processus');
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting all processus:', error);
            throw error;
        }
    }

    // Get indicateurs for a specific processus
    static async getIndicateursByProcessus(processus) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('processus', sql.VarChar, processus)
                .query(`
                    SELECT DISTINCT indicateur 
                    FROM user_permissions 
                    WHERE processus = @processus
                    ORDER BY indicateur
                `);
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting indicateurs by processus:', error);
            throw error;
        }
    }

    // Add permission for user
    static async addPermission(userId, processus, indicateur) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('processus', sql.VarChar, processus)
                .input('indicateur', sql.VarChar, indicateur)
                .query(`
                    INSERT INTO user_permissions (user_id, processus, indicateur)
                    VALUES (@userId, @processus, @indicateur)
                `);
            
            return true;
        } catch (error) {
            console.error('Error adding permission:', error);
            throw error;
        }
    }

    // Remove permission for user
    static async removePermission(userId, processus, indicateur) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('processus', sql.VarChar, processus)
                .input('indicateur', sql.VarChar, indicateur)
                .query(`
                    DELETE FROM user_permissions 
                    WHERE user_id = @userId AND processus = @processus AND indicateur = @indicateur
                `);
            
            return true;
        } catch (error) {
            console.error('Error removing permission:', error);
            throw error;
        }
    }

    // Get users with specific permissions
    static async getUsersByPermission(processus, indicateur) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('processus', sql.VarChar, processus)
                .input('indicateur', sql.VarChar, indicateur)
                .query(`
                    SELECT u.id, u.username, u.isAdmin
                    FROM users u
                    INNER JOIN user_permissions up ON u.id = up.user_id
                    WHERE up.processus = @processus AND up.indicateur = @indicateur
                `);
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting users by permission:', error);
            throw error;
        }
    }

    // Get all permissions with user info
    static async getAllWithUsers() {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .query(`
                    SELECT up.id, up.user_id, u.username, up.processus, up.indicateur
                    FROM user_permissions up
                    INNER JOIN users u ON up.user_id = u.id
                    ORDER BY u.username, up.processus, up.indicateur
                `);
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting all permissions with users:', error);
            throw error;
        }
    }
    static async getUserIndicators(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`SELECT processus, indicateur,  created_at
                            FROM user_permissions
                            WHERE user_id = @userId`);
                return result.recordset;
        } catch (error) {
            console.error('Error getting user indicators information:', error);
            throw error;
        }
    }
}

module.exports = UserPermission;