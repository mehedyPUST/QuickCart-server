import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../../config/db';
import { authenticate, authorize } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(authenticate);
router.use(authorize('owner'));

const itemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.number().int().min(1), // cents
    imageUrl: z.string().url().optional().or(z.literal('')),
    category: z.string().min(1),
    inStock: z.boolean().optional(),
    stockQuantity: z.number().int().min(0).optional(),
});

// GET /api/owner/items - list all items for own store
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (!store) return res.status(404).json({ message: 'Store not found' });

        const items = await db.collection('items').find({ storeId: store._id }).toArray();
        res.json({ items });
    } catch (error) {
        logger.error(error, 'Get items error');
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/owner/items - add a new item
router.post('/', async (req: Request, res: Response) => {
    try {
        const data = itemSchema.parse(req.body);
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (!store) return res.status(404).json({ message: 'Store not found' });

        const item = {
            storeId: store._id,
            name: data.name,
            description: data.description || '',
            price: data.price,
            imageUrl: data.imageUrl || null,
            category: data.category,
            inStock: data.stockQuantity !== undefined ? data.stockQuantity > 0 : (data.inStock !== undefined ? data.inStock : true),
            stockQuantity: data.stockQuantity || 0,
            createdAt: new Date(),
        };

        const result = await db.collection('items').insertOne(item);
        res.status(201).json({ item: { ...item, _id: result.insertedId } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.issues });
        }
        logger.error(error, 'Add item error');
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/owner/items/:id - update an item
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const data = itemSchema.partial().parse(req.body);
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (!store) return res.status(404).json({ message: 'Store not found' });

        const itemId = new ObjectId(req.params.id);
        const item = await db.collection('items').findOne({ _id: itemId, storeId: store._id });
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const updateFields: any = {};
        if (data.name !== undefined) updateFields.name = data.name;
        if (data.description !== undefined) updateFields.description = data.description;
        if (data.price !== undefined) updateFields.price = data.price;
        if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl || null;
        if (data.category !== undefined) updateFields.category = data.category;
        if (data.stockQuantity !== undefined) {
            updateFields.stockQuantity = data.stockQuantity;
            updateFields.inStock = data.stockQuantity > 0;
        } else if (data.inStock !== undefined) {
            updateFields.inStock = data.inStock;
        }

        await db.collection('items').updateOne(
            { _id: itemId },
            { $set: updateFields }
        );
        const updated = await db.collection('items').findOne({ _id: itemId });
        res.json({ item: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: error.issues });
        }
        logger.error(error, 'Update item error');
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/owner/items/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const db = getDB();
        const store = await db.collection('stores').findOne({ ownerId: new ObjectId(req.user!.userId) });
        if (!store) return res.status(404).json({ message: 'Store not found' });

        const itemId = new ObjectId(req.params.id);
        const result = await db.collection('items').deleteOne({ _id: itemId, storeId: store._id });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Item not found' });
        res.json({ message: 'Item deleted' });
    } catch (error) {
        logger.error(error, 'Delete item error');
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;