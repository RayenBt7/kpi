const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { poolPromise, sql } = require('../config/database');
const emailService = require('../services/emailService');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_MINUTES = 30;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Email transporter ─────────────────────────────────────────────────────────
// ── POST /api/auth/forgot-password ────────────────────────────────────────────
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // ── Check SMTP config before doing anything ───────────────────────────
        if (!emailService.isConfigured()) {
            console.error('Email service is not configured in backend/.env');
            return res.status(500).json({
                error: 'Email service is not configured. Please contact the administrator.',
                details: 'Configure EMAIL_PROVIDER with SMTP_* or RESEND_* variables in backend/.env'
            });
        }

        // Find user by email
        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.VarChar(255), email.trim().toLowerCase())
            .query('SELECT id, username, email FROM users WHERE LOWER(email) = @email');

        const user = result.recordset[0];

        // Always return success to avoid user enumeration
        if (!user) {
            return res.json({
                message: 'If that email is registered, you will receive a reset link shortly.'
            });
        }

        // Generate secure random token
        const rawToken = crypto.randomBytes(32).toString('hex');

        // Set expiry time
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

        // Store token in DB first (so it's saved even if email fails)
        await PasswordReset.create(user.id, rawToken, expiresAt);

        // Build reset link
        const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

        // Send email
        try {
            await emailService.sendEmail({
                to: user.email,
                subject: 'Réinitialisation de votre mot de passe — AAF KPI',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 10px;">
                        <h2 style="color: #1d4ed8;">Réinitialisation du mot de passe</h2>
                        <p>Bonjour <strong>${user.username}</strong>,</p>
                        <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte AAF KPI.</p>
                        <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}"
                               style="background-color: #1d4ed8; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                                Réinitialiser mon mot de passe
                            </a>
                        </div>
                        <p style="color: #6b7280; font-size: 13px;">
                            Ce lien est valable pendant <strong>${TOKEN_EXPIRY_MINUTES} minutes</strong>.
                            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                        </p>
                        <hr style="border-color: #e5e7eb; margin-top: 30px;">
                        <p style="color: #9ca3af; font-size: 12px;">AAF KPI Intranet — Ne pas répondre à cet email.</p>
                    </div>
                `,
            });
            console.log(`Password reset email sent to ${user.email} for user ${user.username}`);
        } catch (emailError) {
            console.error('Failed to send reset email:', emailError.message);
            return res.status(500).json({
                error: 'Failed to send email. Check email configuration in .env file.',
                details: emailError.message
            });
        }

        res.json({
            message: 'If that email is registered, you will receive a reset link shortly.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request', details: error.message });
    }
};

// ── GET /api/auth/verify-reset-token?token=xxx ────────────────────────────────
const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ valid: false, error: 'Token is required' });
        }

        const record = await PasswordReset.findValidToken(token);

        if (!record) {
            return res.status(400).json({ valid: false, error: 'Token is invalid or expired' });
        }

        res.json({
            valid: true,
            username: record.username,
            expiresAt: record.expires_at,
        });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({ valid: false, error: 'Failed to verify token' });
    }
};

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Find and validate the token
        const record = await PasswordReset.findValidToken(token);

        if (!record) {
            return res.status(400).json({ error: 'Token is invalid or has expired. Please request a new reset link.' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update user's password
        const pool = await poolPromise;
        await pool.request()
            .input('userId', sql.Int, record.user_id)
            .input('password_hash', sql.VarChar(255), hashedPassword)
            .query('UPDATE users SET password_hash = @password_hash WHERE id = @userId');

        // Mark token as used
        await PasswordReset.markUsed(record.id);

        console.log(`Password reset successfully for user ${record.username}`);

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password', details: error.message });
    }
};

// ── PUT /api/auth/update-email ─────────────────────────────────────────────────
// Allows a logged-in user to set/update their email
const updateEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.user.id;

        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if email is already used by another user
        const pool = await poolPromise;
        const checkResult = await pool.request()
            .input('email', sql.VarChar(255), email.trim().toLowerCase())
            .input('userId', sql.Int, userId)
            .query('SELECT id FROM users WHERE LOWER(email) = @email AND id != @userId');

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({ error: 'Email is already used by another account' });
        }

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('email', sql.VarChar(255), email.trim().toLowerCase())
            .query('UPDATE users SET email = @email WHERE id = @userId');

        res.json({ message: 'Email updated successfully' });
    } catch (error) {
        console.error('Update email error:', error);
        res.status(500).json({ error: 'Failed to update email', details: error.message });
    }
};

module.exports = {
    forgotPassword,
    verifyResetToken,
    resetPassword,
    updateEmail,
};
