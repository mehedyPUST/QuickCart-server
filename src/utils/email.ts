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
    // DEV: redirect all emails to your test address
    const recipient = env.DEV_EMAIL_OVERRIDE || to;
    const finalSubject = env.DEV_EMAIL_OVERRIDE
        ? `[To: ${to}] ${subject}`
        : subject;

    if (!resend) {
        logger.warn(`[DEV EMAIL] To: ${recipient}, Subject: ${finalSubject}`);
        logger.warn(html);
        return;
    }

    try {
        const { error } = await resend.emails.send({
            from: env.EMAIL_FROM,
            to: recipient,
            subject: finalSubject,
            html,
        });

        if (error) {
            logger.error(error, `Failed to send email to ${recipient}`);
            return;
        }

        logger.info(`Email sent to ${recipient} (original: ${to})`);
    } catch (error) {
        logger.error(error, `Email error for ${recipient}`);
    }
}