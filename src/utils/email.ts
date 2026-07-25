import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    family: 4,
} as any); // bypass TS overload issue

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
        // OTP is still visible in logs – do not throw
    }
}