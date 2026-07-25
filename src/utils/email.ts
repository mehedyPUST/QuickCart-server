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
    // Debug: log the actual from address being used
    logger.info(`Attempting to send email from: "${env.EMAIL_FROM}"`);

    if (!resend) {
        logger.warn(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
        logger.warn(html);
        return;
    }

    try {
        const { error } = await resend.emails.send({
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
        });

        if (error) {
            logger.error(error, `Failed to send email to ${to}`);
            // OTP is still in logs, so we don't throw
            return;
        }

        logger.info(`Email sent to ${to}`);
    } catch (error) {
        logger.error(error, `Email error for ${to}`);
    }
}