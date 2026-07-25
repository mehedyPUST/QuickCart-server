import { Router, Request, Response } from 'express';
import { stripe } from '../utils/stripe';
import { env } from '../config/env';
import { getDB } from '../config/db';
import { logger } from '../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();

// Stripe webhook – raw body already parsed by express.raw in index.ts
router.post('/stripe', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event;
    try {
        // req.body is a Buffer because of express.raw
        event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        logger.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { orderId } = session.metadata!;

        const db = getDB();
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            logger.error(`Order not found: ${orderId}`);
            return res.status(404).send('Order not found');
        }

        await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { paymentStatus: 'paid', status: 'paid' } }
        );

        // Deduct stock
        for (const item of order.items) {
            await db.collection('items').updateOne(
                { _id: item.itemId, stockQuantity: { $gte: item.quantity } },
                { $inc: { stockQuantity: -item.quantity } }
            );
            const updatedItem = await db.collection('items').findOne({ _id: item.itemId });
            if (updatedItem) {
                await db.collection('items').updateOne(
                    { _id: item.itemId },
                    { $set: { inStock: updatedItem.stockQuantity > 0 } }
                );
            }
        }

        logger.info(`Order ${orderId} paid and stock updated`);
    }

    res.json({ received: true });
});

export default router;