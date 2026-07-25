import { Router, Request, Response } from 'express';
import { getDB } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(authenticate);
router.use(authorize('customer'));

// GET /api/customer/cart
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const cart = await db.collection('carts').findOne({ userId: new ObjectId(req.user!.userId) });
        if (!cart) return res.json({ cart: { items: [] } });
        res.json({ cart });
    } catch (error) {
        logger.error(error, 'Get cart error');
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/customer/cart (replace entire cart)
router.put('/', async (req: Request, res: Response) => {
    try {
        const { items } = req.body; // array of { itemId, storeId, name, price, quantity }
        const db = getDB();
        const userId = new ObjectId(req.user!.userId);

        await db.collection('carts').updateOne(
            { userId },
            { $set: { userId, items, updatedAt: new Date() } },
            { upsert: true }
        );

        res.json({ message: 'Cart updated' });
    } catch (error) {
        logger.error(error, 'Update cart error');
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/customer/cart/merge – merge guest items into user's cart (called after login)
router.post('/merge', async (req: Request, res: Response) => {
    try {
        const { guestItems } = req.body; // array of CartItem
        const db = getDB();
        const userId = new ObjectId(req.user!.userId);

        const existingCart = await db.collection('carts').findOne({ userId });
        let mergedItems = existingCart?.items || [];

        for (const guestItem of guestItems) {
            const existingIndex = mergedItems.findIndex(
                (i: any) => i.itemId === guestItem.itemId && i.storeId === guestItem.storeId
            );
            if (existingIndex > -1) {
                mergedItems[existingIndex].quantity += guestItem.quantity;
            } else {
                mergedItems.push(guestItem);
            }
        }

        await db.collection('carts').updateOne(
            { userId },
            { $set: { items: mergedItems, updatedAt: new Date() } },
            { upsert: true }
        );

        res.json({ message: 'Cart merged' });
    } catch (error) {
        logger.error(error, 'Merge cart error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;