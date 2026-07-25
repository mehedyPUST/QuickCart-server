import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for others
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
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
        // Do not throw – OTP is still valid and visible in logs
    }
}