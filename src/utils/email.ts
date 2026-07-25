import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

// Build connection URL to avoid type mismatches
const smtpUrl = `smtp://${encodeURIComponent(env.SMTP_USER)}:${encodeURIComponent(env.SMTP_PASS)}@${env.SMTP_HOST}:${env.SMTP_PORT || 587}`;

const transporter = nodemailer.createTransport(smtpUrl, {
    tls: {
        rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    family: 4, // Force IPv4
});

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
    try {
        const info = await transporter.sendMail({
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
        });
        logger.info(`Email sent to ${to} (ID: ${info.messageId})`);
    } catch (error) {
        logger.error(error, `Failed to send email to ${to}`);
        // OTP is still visible in logs – no throw
    }
}