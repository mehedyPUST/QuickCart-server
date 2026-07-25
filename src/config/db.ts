import { MongoClient, Db } from 'mongodb';
import { env } from './env';
import { logger } from '../utils/logger';

let client: MongoClient;
let db: Db;

export async function connectDB(): Promise<Db> {
    if (db) return db;

    try {
        client = new MongoClient(env.MONGODB_URI);
        await client.connect();
        db = client.db(); // uses DB from connection string, or 'test'
        logger.info('Connected to MongoDB');
        return db;
    } catch (error) {
        logger.error(error, 'Failed to connect to MongoDB');
        process.exit(1);
    }
}

export function getDB(): Db {
    if (!db) throw new Error('Database not initialized. Call connectDB() first.');
    return db;
}

export async function closeDB(): Promise<void> {
    if (client) await client.close();
}