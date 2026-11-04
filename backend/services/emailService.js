const nodemailer = require('nodemailer');

const getEmailProvider = () => String(process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();

const getDefaultFrom = () => (
    process.env.EMAIL_FROM ||
    (process.env.SMTP_USER ? `"AAF KPI" <${process.env.SMTP_USER}>` : '')
);

const createSmtpTransporter = () =>
    nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

const isConfigured = () => {
    if (getEmailProvider() === 'resend') {
        return Boolean(process.env.RESEND_API_KEY && getDefaultFrom());
    }

    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
};

const sendWithResend = async ({ from, to, subject, html, text, replyTo }) => {
    let Resend;
    try {
        ({ Resend } = require('resend'));
    } catch (error) {
        throw new Error('Resend package is not installed in backend. Run: npm --prefix backend install resend');
    }

    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is missing in backend/.env');
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const response = await resend.emails.send({
        from: from || getDefaultFrom(),
        to,
        subject,
        html,
        text,
        replyTo,
    });

    if (response.error) {
        const message = response.error.message || 'Resend email send failed';
        if (message.toLowerCase().includes('only send testing emails')) {
            throw new Error(
                `${message} For development, test with the Resend account email. For production, verify a domain in Resend and set EMAIL_FROM to an address on that domain.`
            );
        }

        throw new Error(message);
    }

    return response.data;
};

const sendWithSmtp = async ({ from, to, subject, html, text, replyTo }) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP_USER or SMTP_PASS is missing in backend/.env');
    }

    const transporter = createSmtpTransporter();
    try {
        return await transporter.sendMail({
            from: from || getDefaultFrom(),
            to,
            subject,
            html,
            text,
            replyTo,
        });
    } catch (error) {
        const message = String(error?.message || '');
        if (message.includes('5.7.139') || message.toLowerCase().includes('smtpauthentication is disabled')) {
            throw new Error(
                'SMTP authentication failed. For Gmail: ensure 2FA is enabled and SMTP_APP_PASSWORD is used instead of your account password. Or set EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM in backend/.env.'
            );
        }

        if (message.toLowerCase().includes('invalid login') || message.toLowerCase().includes('535-5.7.8')) {
            throw new Error(
                'Gmail SMTP login failed. For Gmail: enable App Passwords (2-Step Verification required) and use that password in SMTP_PASS. If using a Google Workspace account, verify SMTP AUTH is enabled in the admin console.'
            );
        }

        throw error;
    }
};

const sendEmail = async (message) => {
    if (!message?.to) {
        throw new Error('Email recipient is required');
    }

    if (!message?.subject) {
        throw new Error('Email subject is required');
    }

    if (!message?.html && !message?.text) {
        throw new Error('Email html or text content is required');
    }

    if (getEmailProvider() === 'resend') {
        return sendWithResend(message);
    }

    return sendWithSmtp(message);
};

module.exports = {
    sendEmail,
    isConfigured,
    getEmailProvider,
    getDefaultFrom,
};
