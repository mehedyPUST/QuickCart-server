import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();

// All routes require owner role
router.use(authenticate);
router.use(authorize('owner'));

// Validation schema for store
const storeSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    address: z.string().min(1),
    pickupHours: z.record(z.object({
        open: z.string(),
        close: z.string(),
    })).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
});

// GET /api/owner/store - get own store
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });

        if (!store) return res.json({ store: null });
        res.json({ store });
    } catch (error) {
        logger.error(error, 'Get store error');
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/owner/store - create a new store
router.post('/', async (req: Request, res: Response) => {
    try {
        const data = storeSchema.parse(req.body);
        const db = getDB();

        // Check if owner already has a store
        const existing = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (existing) {
            return res.status(409).json({ message: 'You already have a store' });
        }

        const store = {
            ownerId: new ObjectId(req.user!.userId),
            name: data.name,
            description: data.description || '',
            address: data.address,
            pickupHours: data.pickupHours || {},
            imageUrl: data.imageUrl || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
            status: 'active', // 'pending', 'active', 'suspended'
            createdAt: new Date(),
        };

        const result = await db.collection('stores').insertOne(store);
        res.status(201).json({ store: { ...store, _id: result.insertedId } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.issues });
        }
        logger.error(error, 'Create store error');
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/owner/store - update existing store
router.put('/', async (req: Request, res: Response) => {
    try {
        const data = storeSchema.partial().parse(req.body);
        const db = getDB();
        const ownerId = new ObjectId(req.user!.userId);

        const store = await db.collection('stores').findOne({ ownerId });
        if (!store) {
            return res.status(404).json({ message: 'Store not found' });
        }

        const updateFields: any = {};
        if (data.name !== undefined) updateFields.name = data.name;
        if (data.description !== undefined) updateFields.description = data.description;
        if (data.address !== undefined) updateFields.address = data.address;
        if (data.pickupHours !== undefined) updateFields.pickupHours = data.pickupHours;
        if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl || null;
        if (data.isActive !== undefined) updateFields.isActive = data.isActive;

        if (Object.keys(updateFields).length > 0) {
            await db.collection('stores').updateOne(
                { ownerId },
                { $set: updateFields }
            );
        }

        const updated = await db.collection('stores').findOne({ ownerId });
        res.json({ store: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.issues });
        }
        logger.error(error, 'Update store error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;