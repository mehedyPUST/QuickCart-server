import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { ITokenPayload } from '../types';  // we'll define next

export function generateAccessToken(payload: ITokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: ITokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): ITokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as ITokenPayload;
}

export function verifyRefreshToken(token: string): ITokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as ITokenPayload;
}