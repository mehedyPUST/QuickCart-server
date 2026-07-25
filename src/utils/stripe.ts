import Stripe from 'stripe';
import { env } from '../config/env';

export const stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-06-30.sdxl' as any, // latest stable
});