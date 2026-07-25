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

    // SMTP / Nodemailer settings
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.string().default('587'),
    SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
    SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
    EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
});

export const env = envSchema.parse(process.env);