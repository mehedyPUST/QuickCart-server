import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserRole } from '../types';

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.access_token;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = payload; // payload: { userId, role, iat, exp }
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

export function authorize(...roles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        next();
    };
}