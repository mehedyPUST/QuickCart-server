import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const urlPattern = /^https?:\/\/.+/;

const envSchema = z.object({
    PORT: z.string().default('5000').transform(Number),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CLIENT_URL: z.string().refine(val => urlPattern.test(val), { message: 'Must be a valid URL' }),
    BACKEND_URL: z.string().refine(val => urlPattern.test(val), { message: 'Must be a valid URL' }),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    STRIPE_SECRET_KEY: z.string().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().default(''),
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default('QuickCart <onboarding@resend.dev>'),
    DEV_EMAIL_OVERRIDE: z.string().email().optional(),
});

export const env = envSchema.parse(process.env);