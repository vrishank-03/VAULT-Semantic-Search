const nodemailer = require('nodemailer');
require('dotenv').config();

// [TASK 15 REFACTOR] Centralized Nodemailer Setup
// [ECONNRESET_FIX] We no longer create a single global transporter.
// A new transporter will be created for each email to prevent stale connections.
// console.log('[EmailService] Initializing Nodemailer transporter...');
// const transporter = ... (REMOVED)
// transporter.verify(... (REMOVED)


/**
 * @desc    Sends an email using the centralized transporter
 * @param   {string} to Recipient's email address
 * @param   {string} subject Email subject line
 * @param   {string} html HTML content for the email
 */
const sendEmail = async (to, subject, html) => {
    console.log(`[EmailService] Attempting to send email to: ${to}`);
    try {
        // [ECONNRESET_FIX] Create a new transporter for *this specific email*.
        // This guarantees a fresh connection and avoids ECONNRESET from idle timeouts.
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT, 10),
            secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        console.log(`[EmailService] Transporter created for ${to}. Verifying connection...`);
        
        // We verify *right before sending* to ensure the connection is good.
        await transporter.verify();
        console.log(`[EmailService] Connection verified. Sending email...`);

        const info = await transporter.sendMail({
            from: `"VAULT" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        
        console.log(`[EmailService] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
        return true; 
    } catch (error) {
        console.error(`[EmailService] Error sending email to ${to}:`, error);
        return false; 
    }
};

module.exports = { sendEmail };