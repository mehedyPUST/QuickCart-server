import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { connectDB } from './config/db';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import './types'; // extend Request type globally

import ownerStoreRoutes from './routes/owner/store';
import ownerItemsRoutes from './routes/owner/items';
import storesRoutes from './routes/stores';
import customerCartRoutes from './routes/customer/cart';



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
app.use('/api/owner/store', ownerStoreRoutes);
app.use('/api/owner/items', ownerItemsRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/customer/cart', customerCartRoutes);




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