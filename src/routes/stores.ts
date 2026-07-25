import { Router, Request, Response } from 'express';
import { getDB } from '../config/db';
import { logger } from '../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();

// GET /api/stores
router.get('/', async (_req: Request, res: Response) => {
    try {
        const db = getDB();
        const stores = await db.collection('stores').find({ isActive: true, status: 'active' }).toArray();
        res.json({ stores });
    } catch (error) {
        logger.error(error, 'Get stores error');
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/stores/:id
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const store = await db.collection('stores').findOne({
            _id: new ObjectId(req.params.id as string),
            isActive: true,
            status: 'active',
        });
        if (!store) return res.status(404).json({ message: 'Store not found' });
        const items = await db.collection('items').find({ storeId: store._id }).toArray();
        res.json({ store, items });
    } catch (error) {
        logger.error(error, 'Get store detail error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;