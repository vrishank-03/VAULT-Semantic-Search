// backend/services/emailService.js
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const dns = require('dns');

// [NETWORK FIX] Force Node to look for IPv4 addresses first
// This fixes the "Greeting never received" timeout on many Windows machines
dns.setDefaultResultOrder('ipv4first');

const SERVICE_NAME = 'EmailService';

// Check if variables exist
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn(SERVICE_NAME, 'Email credentials missing in .env. Email sending will fail.');
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // Must be FALSE for port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/"/g, '') : undefined, // Remove quotes if present
    },
    // [TIMEOUT FIXES] Increase timeouts for slow connections
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,   // 10 seconds
    socketTimeout: 10000,     // 10 seconds
    tls: {
        // [DEV ONLY] Helps if you are behind a strict corporate proxy
        rejectUnauthorized: false
    }
});

/**
 * Sends an email using the configured transporter.
 */
const sendEmail = async (to, subject, text, html) => {
    logger.info(SERVICE_NAME, `Attempting to send email to: ${to}`);

    const mailOptions = {
        from: `"VAULT System" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
    };

    try {
        // Verify connection before sending
        await transporter.verify();
        logger.debug(SERVICE_NAME, 'SMTP Connection verified.');

        const info = await transporter.sendMail(mailOptions);
        logger.info(SERVICE_NAME, `Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(SERVICE_NAME, `Error sending email to ${to}: ${error.message}`);
        // We do NOT throw here so the signup process doesn't crash.
        // We just log the failure.
        return null; 
    }
};

module.exports = { sendEmail };