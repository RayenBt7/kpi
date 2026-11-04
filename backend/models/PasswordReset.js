const sql = require('mssql');
const { poolPromise } = require('../config/database');

class PasswordReset {
    // Create a new reset token for a user
    static async create(userId, token, expiresAt) {
        try {
            const pool = await poolPromise;
            // Invalidate any existing unused tokens for this user
            await pool.request()
                .input('userId', sql.Int, userId)
                .query('UPDATE password_resets SET used = 1 WHERE user_id = @userId AND used = 0');

            // Insert new token
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('token', sql.VarChar(255), token)
                .input('expiresAt', sql.DateTime, expiresAt)
                .query(`
                    INSERT INTO password_resets (user_id, token, expires_at, used)
                    VALUES (@userId, @token, @expiresAt, 0)
                `);

            return true;
        } catch (error) {
            console.error('Error creating password reset token:', error);
            throw error;
        }
    }

    // Find a valid (unused, not expired) token
    static async findValidToken(token) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('token', sql.VarChar(255), token)
                .input('now', sql.DateTime, new Date())
                .query(`
                    SELECT pr.id, pr.user_id, pr.token, pr.expires_at, pr.used,
                           u.username, u.email
                    FROM password_resets pr
                    INNER JOIN users u ON pr.user_id = u.id
                    WHERE pr.token = @token
                      AND pr.used = 0
                      AND pr.expires_at > @now
                `);

            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error finding reset token:', error);
            throw error;
        }
    }

    // Mark a token as used
    static async markUsed(id) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE password_resets SET used = 1 WHERE id = @id');
            return true;
        } catch (error) {
            console.error('Error marking token as used:', error);
            throw error;
        }
    }

    // Clean up old/expired tokens (optional maintenance)
    static async deleteExpired() {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('now', sql.DateTime, new Date())
                .query('DELETE FROM password_resets WHERE expires_at < @now OR used = 1');
            return true;
        } catch (error) {
            console.error('Error deleting expired tokens:', error);
            throw error;
        }
    }
}

module.exports = PasswordReset;
