const emailService = require('../services/emailService');

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || process.env.SMTP_USER || 'info@aaf.com.in';

const sendContactEmail = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required' });
        }

        if (!emailService.isConfigured()) {
            return res.status(500).json({ error: 'Email service is not configured' });
        }

        await emailService.sendEmail({
            to: CONTACT_EMAIL,
            subject: `Contact form: ${name}`,
            replyTo: email,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
                    <h2 style="color: #1d4ed8;">New Contact Form Submission</h2>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Message:</strong></p>
                        <p style="white-space: pre-wrap;">${message}</p>
                    </div>
                    <p style="color: #6b7280; font-size: 12px;">Sent via AAF contact form</p>
                </div>
            `,
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
        });

        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
};

module.exports = { sendContactEmail };