import { Router, Request, Response } from 'express';
import { stripe } from '../utils/stripe';
import { env } from '../config/env';
import { getDB } from '../config/db';
import { logger } from '../utils/logger';
import { ObjectId } from 'mongodb';
import { sendEmail } from '../utils/email';

const router = Router();

// Stripe webhook – raw body needed for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        logger.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { orderId } = session.metadata!;

        const db = getDB();
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            logger.error(`Order not found: ${orderId}`);
            return res.status(404).send('Order not found');
        }

        // Update order status
        await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { paymentStatus: 'paid', status: 'paid' } }
        );

        // Deduct stock atomically
        for (const item of order.items) {
            await db.collection('items').updateOne(
                {
                    _id: item.itemId,
                    stockQuantity: { $gte: item.quantity },
                },
                {
                    $inc: { stockQuantity: -item.quantity },
                    $set: { inStock: { $cond: [{ $gt: ['$stockQuantity', item.quantity] }, true, false] } }, // alternative: just set inStock after
                }
            );
            // simpler: findOneAndUpdate with condition and then update inStock
            await db.collection('items').updateOne(
                { _id: item.itemId, stockQuantity: { $gte: item.quantity } },
                { $inc: { stockQuantity: -item.quantity } }
            );
            // Update inStock based on new quantity
            const updatedItem = await db.collection('items').findOne({ _id: item.itemId });
            if (updatedItem) {
                await db.collection('items').updateOne(
                    { _id: item.itemId },
                    { $set: { inStock: updatedItem.stockQuantity > 0 } }
                );
            }
        }

        // Send order confirmation email (optional – we'll keep simple)
        logger.info(`Order ${orderId} paid and stock updated`);

        // Send confirmation email to customer (if email available)
        // const customer = await db.collection('users').findOne({ _id: order.customerId });
        // if (customer?.email) { ... }
    }

    res.json({ received: true });
});

export default router;