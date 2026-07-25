import { Router, Request, Response } from 'express';
import { getDB } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();
router.use(authenticate);
router.use(authorize('owner'));

// GET /api/owner/orders – list orders for owner's store
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (!store) return res.status(404).json({ message: 'Store not found' });

        const orders = await db.collection('orders')
            .find({ storeId: store._id })
            .sort({ createdAt: -1 })
            .toArray();

        res.json({ orders });
    } catch (error) {
        logger.error(error, 'Owner orders error');
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/owner/orders/:id/status – update order status
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const { status } = req.body; // expecting 'paid', 'preparing', 'ready', 'completed'
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (!store) return res.status(404).json({ message: 'Store not found' });

        const orderId = new ObjectId(req.params.id);
        const order = await db.collection('orders').findOne({ _id: orderId, storeId: store._id });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        await db.collection('orders').updateOne(
            { _id: orderId },
            { $set: { status } }
        );

        res.json({ message: 'Order status updated' });
    } catch (error) {
        logger.error(error, 'Update order status error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;