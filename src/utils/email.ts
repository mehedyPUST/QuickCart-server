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
        logger.warn(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
        logger.warn(html);
        return;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: env.EMAIL_FROM,
            to,
            subject,
            html,
        });

        if (error) {
            logger.error(error, `Failed to send email to ${to}`);
            throw new Error(`Email send failed: ${error.message}`);
        }

        logger.info(`Email sent to ${to} (ID: ${data?.id})`);
    } catch (error) {
        logger.error(error, `Email error for ${to}`);
        throw error; // Now we re-throw so the calling route knows it failed
    }
}