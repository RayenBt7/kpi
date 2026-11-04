const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { poolPromise } = require('../config/database');

const SALT_ROUNDS = 10;
const USER_TYPE_OPTIONS = ['user', 'responsable', 'pilote'];

const normalizeUserType = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return USER_TYPE_OPTIONS.includes(normalized) ? normalized : 'user';
};

class User {
    static async hasUserTypeColumn() {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT CASE
                WHEN COL_LENGTH('dbo.users', 'user_type') IS NULL THEN 0
                ELSE 1
            END AS hasUserTypeColumn
        `);

        return Number(result.recordset?.[0]?.hasUserTypeColumn) === 1;
    }

    static async ensureUserTypeColumn() {
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
    }

    // Find user by username
    static async findByUsername(username) {
        try {
            const hasUserTypeColumn = await this.hasUserTypeColumn();
            const pool = await poolPromise;
            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .query(
                    hasUserTypeColumn
                        ? `
                            SELECT
                                id,
                                username,
                                password_hash,
                                isAdmin,
                                COALESCE(NULLIF(LTRIM(RTRIM(user_type)), ''), 'user') AS user_type
                            FROM users
                            WHERE username = @username
                        `
                        : `
                            SELECT
                                id,
                                username,
                                password_hash,
                                isAdmin,
                                CAST('user' AS NVARCHAR(50)) AS user_type
                            FROM users
                            WHERE username = @username
                        `
                );
            
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error finding user by username:', error);
            throw error;
        }
    }

    // Find user by ID
    static async findById(id) {
        try {
            const hasUserTypeColumn = await this.hasUserTypeColumn();
            const pool = await poolPromise;
            const result = await pool.request()
                .input('id', sql.Int, id)
                .query(
                    hasUserTypeColumn
                        ? `
                            SELECT
                                id,
                                username,
                                email,
                                isAdmin,
                                COALESCE(NULLIF(LTRIM(RTRIM(user_type)), ''), 'user') AS user_type
                            FROM users
                            WHERE id = @id
                        `
                        : `
                            SELECT
                                id,
                                username,
                                email,
                                isAdmin,
                                CAST('user' AS NVARCHAR(50)) AS user_type
                            FROM users
                            WHERE id = @id
                        `
                );
            
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    // Create a new user
    static async create(userData) {
        try {
            const { username, password, isAdmin = false, userType = 'user' } = userData;
            const normalizedUserType = normalizeUserType(userType);
            const hasUserTypeColumn = await this.hasUserTypeColumn();
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            
            const pool = await poolPromise;
            const request = pool.request()
                .input('username', sql.VarChar, username)
                .input('password_hash', sql.VarChar, hashedPassword)
                .input('isAdmin', sql.Bit, isAdmin);

            const result = hasUserTypeColumn
                ? await request
                    .input('user_type', sql.NVarChar(50), normalizedUserType)
                    .query(`
                        INSERT INTO users (username, password_hash, isAdmin, user_type)
                        VALUES (@username, @password_hash, @isAdmin, @user_type);
                        SELECT SCOPE_IDENTITY() AS id;
                    `)
                : await request.query(`
                    INSERT INTO users (username, password_hash, isAdmin)
                    VALUES (@username, @password_hash, @isAdmin);
                    SELECT SCOPE_IDENTITY() AS id;
                `);
            
            return {
                id: result.recordset[0].id,
                username: username,
                isAdmin: isAdmin,
                userType: hasUserTypeColumn ? normalizedUserType : 'user',
            };
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    // Verify password
    static async verifyPassword(plainPassword, hashedPassword) {
        try {
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            console.error('Error verifying password:', error);
            throw error;
        }
    }

    // Get all users
    static async getAll() {
        try {
            const hasUserTypeColumn = await this.hasUserTypeColumn();
            const pool = await poolPromise;
            const result = await pool.request()
                .query(
                    hasUserTypeColumn
                        ? `
                            SELECT
                                id,
                                username,
                                isAdmin,
                                COALESCE(NULLIF(LTRIM(RTRIM(user_type)), ''), 'user') AS user_type
                            FROM users
                        `
                        : `
                            SELECT
                                id,
                                username,
                                isAdmin,
                                CAST('user' AS NVARCHAR(50)) AS user_type
                            FROM users
                        `
                );
            
            return result.recordset;
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }

    // Update user admin status
    static async updateAdminStatus(id, isAdmin) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('id', sql.Int, id)
                .input('isAdmin', sql.Bit, isAdmin)
                .query('UPDATE users SET isAdmin = @isAdmin WHERE id = @id');
            
            return true;
        } catch (error) {
            console.error('Error updating admin status:', error);
            throw error;
        }
    }

    // Update user type
    static async updateUserType(id, userType) {
        try {
            let hasUserTypeColumn = await this.hasUserTypeColumn();
            if (!hasUserTypeColumn) {
                await this.ensureUserTypeColumn();
                hasUserTypeColumn = await this.hasUserTypeColumn();
            }

            if (!hasUserTypeColumn) {
                throw new Error('users.user_type column is missing');
            }

            const normalizedUserType = normalizeUserType(userType);
            const pool = await poolPromise;
            await pool.request()
                .input('id', sql.Int, id)
                .input('user_type', sql.NVarChar(50), normalizedUserType)
                .query('UPDATE users SET user_type = @user_type WHERE id = @id');

            return normalizedUserType;
        } catch (error) {
            console.error('Error updating user type:', error);
            throw error;
        }
    }

    // Delete user
    static async delete(id) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM users WHERE id = @id');
            
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
}

module.exports = User;
