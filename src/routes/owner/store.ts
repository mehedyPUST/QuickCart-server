import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(authenticate);
router.use(authorize('owner'));

const storeSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    address: z.string().min(1),
    pickupHours: z.record(z.string(), z.object({
        open: z.string(),
        close: z.string(),
    })).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
});

// GET /api/owner/store
router.get('/', async (req: Request, res: Response) => {
    const db = getDB();
    const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
    res.json({ store });
});

// PUT /api/owner/store (create or update)
router.put('/', async (req: Request, res: Response) => {
    try {
        const data = storeSchema.partial().parse(req.body);
        const db = getDB();
        const ownerId = new ObjectId(req.user!.userId);
        const store = await db.collection('stores').findOne({ ownerId });

        const updateFields: any = {};
        if (data.name !== undefined) updateFields.name = data.name;
        if (data.description !== undefined) updateFields.description = data.description;
        if (data.address !== undefined) updateFields.address = data.address;
        if (data.pickupHours !== undefined) updateFields.pickupHours = data.pickupHours;
        if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl || null;
        if (data.isActive !== undefined) updateFields.isActive = data.isActive;

        if (store) {
            if (Object.keys(updateFields).length > 0) {
                await db.collection('stores').updateOne({ ownerId }, { $set: updateFields });
            }
        } else {
            // Create new store with all required fields
            const newStore = {
                ownerId,
                name: data.name || 'Untitled',
                description: data.description || '',
                address: data.address || '',
                pickupHours: data.pickupHours || {},
                imageUrl: data.imageUrl || null,
                isActive: data.isActive !== undefined ? data.isActive : true,
                status: 'active',
                createdAt: new Date(),
            };
            await db.collection('stores').insertOne(newStore);
        }

        const updated = await db.collection('stores').findOne({ ownerId });
        res.json({ store: updated });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: error.issues });
        logger.error(error, 'Update store error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;