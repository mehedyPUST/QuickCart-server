import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { connectDB } from './config/db';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import './types'; // extend Request type globally

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
    cors({
        origin: env.CLIENT_URL,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

async function start() {
    await connectDB();
    app.listen(env.PORT, () => {
        logger.info(`Server running on port ${env.PORT}`);
    });
}

start().catch((err) => {
    logger.error(err);
    process.exit(1);
});

export default app;