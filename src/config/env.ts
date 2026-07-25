import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('5000').transform(Number),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL').default('http://localhost:3000'),
    BACKEND_URL: z.string().url('BACKEND_URL must be a valid URL').default('http://localhost:5000'),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
    STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),

    // Resend for email sending
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: z.string().default('QuickCart <onboarding@resend.dev>'),

    // Dev email override — all emails go to this address when set
    DEV_EMAIL_OVERRIDE: z.string().email().optional(),
});

export const env = envSchema.parse(process.env);