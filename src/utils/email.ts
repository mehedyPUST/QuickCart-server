import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from './logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
    if (!resend) {
        // Development fallback – just log to console
        logger.info(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
        logger.info(html);
        return;
    }

    try {
        await resend.emails.send({
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
        });
        logger.info(`Email sent to ${to}`);
    } catch (error) {
        logger.error(`Failed to send email to ${to}`, error);
        // In production you might want to throw, but for OTP we can continue
    }
}