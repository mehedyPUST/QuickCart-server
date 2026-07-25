import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { stripe } from '../../utils/stripe';
import { env } from '../../config/env';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(authenticate);
router.use(authorize('customer'));

// Schema for creating checkout session
const checkoutSchema = z.object({
    storeId: z.string().min(1),
    items: z.array(z.object({
        itemId: z.string(),
        name: z.string(),
        price: z.number().int(),
        quantity: z.number().int().min(1),
    })),
    pickupTime: z.string().datetime(), // ISO 8601
});

// POST /api/customer/orders/create-checkout-session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
    try {
        const { storeId, items, pickupTime } = checkoutSchema.parse(req.body);
        const db = getDB();
        const customerId = new ObjectId(req.user!.userId);

        // Verify store exists and is active
        const store = await db.collection('stores').findOne({
            _id: new ObjectId(storeId),
            isActive: true,
            status: 'active',
        });
        if (!store) return res.status(404).json({ message: 'Store not found or inactive' });

        // Verify all items belong to the store and are in stock
        const itemIds = items.map(i => new ObjectId(i.itemId));
        const dbItems = await db.collection('items').find({
            _id: { $in: itemIds },
            storeId: new ObjectId(storeId),
            inStock: true,
        }).toArray();

        if (dbItems.length !== items.length) {
            return res.status(400).json({ message: 'Some items are unavailable or don’t belong to this store' });
        }

        // Calculate subtotal (in cents)
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        // Create order with status 'pending', paymentStatus 'unpaid'
        const order = {
            customerId,
            storeId: new ObjectId(storeId),
            items: items.map(i => ({
                itemId: new ObjectId(i.itemId),
                name: i.name,
                price: i.price,
                quantity: i.quantity,
            })),
            subtotal,
            pickupTime: new Date(pickupTime),
            status: 'pending',
            paymentStatus: 'unpaid',
            stripeSessionId: null as string | null,
            createdAt: new Date(),
        };

        const orderResult = await db.collection('orders').insertOne(order);
        const orderId = orderResult.insertedId.toString();

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: req.user?.email, // optional if available
            line_items: items.map(i => ({
                price_data: {
                    currency: 'usd',
                    product_data: { name: i.name },
                    unit_amount: i.price,
                },
                quantity: i.quantity,
            })),
            metadata: {
                orderId,
                storeId,
            },
            success_url: `${env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${env.CLIENT_URL}/checkout/cancel`,
        });

        // Save Stripe session ID on the order
        await db.collection('orders').updateOne(
            { _id: orderResult.insertedId },
            { $set: { stripeSessionId: session.id } }
        );

        res.json({ url: session.url });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.issues });
        }
        logger.error(error, 'Checkout session creation error');
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/customer/orders – list own orders
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const orders = await db.collection('orders').find({
            customerId: new ObjectId(req.user!.userId),
        }).sort({ createdAt: -1 }).toArray();
        res.json({ orders });
    } catch (error) {
        logger.error(error, 'Get orders error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;